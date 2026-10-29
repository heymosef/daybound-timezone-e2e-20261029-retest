"""Check local report-template semantics, not PostHog's live parser or schema."""
import json
from pathlib import Path
import re
import sqlite3

project = Path(__file__).resolve().parent.parent
database = sqlite3.connect(":memory:")
database.row_factory = sqlite3.Row
database.execute("CREATE TABLE events (distinct_id TEXT, event TEXT, timestamp TEXT, properties TEXT)")
database.create_function("toInt", 1, lambda value: int(value) if value is not None else None)


def event(identity, journey, kind, attempt=1, **properties):
    data = {"search_version": 2, "search_id": journey, "attempt": attempt, **properties}
    database.execute("INSERT INTO events VALUES (?, ?, ?, ?)",
                     (identity, "timezone_search_" + kind, "2026-10-21T12:00:00Z", json.dumps(data)))


# Two searches on the same page must not be mixed. A reused synthetic ID on a
# different page tests the second join key too. All names below are test data.
event("page-a", "journey-a", "attempted", requested_city="Utrecht", requested_city_id=2745912,
      requested_country="NL", requested_region="09", requested_timezone="Europe/Amsterdam",
      recognition="city", no_results=True, missing_city=True)
# Duplicate delivery must not create a second failed attempt or outcome.
event("page-a", "journey-a", "attempted", requested_city="Utrecht", requested_city_id=2745912,
      requested_country="NL", requested_region="09", requested_timezone="Europe/Amsterdam",
      recognition="city", no_results=True, missing_city=True)
event("page-a", "journey-a", "attempted", 2, requested_city="Amsterdam", recognition="ambiguous", no_results=False)
for _ in range(2):
    event("page-a", "journey-a", "selected", 2, selected_city="Amsterdam", selected_country="Netherlands",
          selected_city_id=2759794, selected_timezone="Europe/Amsterdam")
event("page-a", "journey-b", "attempted", filtered_query="vancuver", recognition="unrecognized", no_results=True)
event("page-a", "journey-b", "attempted", 2, requested_city="Vancouver", recognition="city", no_results=False)
event("page-a", "journey-b", "selected", 2, selected_city="Vancouver", selected_city_id=6173331,
      selected_timezone="America/Vancouver")
event("page-b", "journey-a", "attempted", requested_city="Tokyo", requested_city_id=1850147,
      requested_country="JP", requested_timezone="Asia/Tokyo", recognition="city", no_results=True, missing_city=True)
event("page-b", "journey-a", "closed", method="outside_click")
event("page-a", "journey-c", "attempted", requested_city="Zurich", requested_city_id=2657896,
      requested_country="CH", requested_timezone="Europe/Zurich", recognition="city", no_results=True, missing_city=True)
event("page-a", "journey-c", "selected", selected_city="Zurich", selected_city_id=2657896,
      selected_timezone="Europe/Zurich")
event("page-a", "journey-d", "attempted", recognition="unrecognized", no_results=True)
# Missing an intermediate event is not a verified consecutive follow-up.
event("page-a", "journey-e", "attempted", requested_city="Utrecht", recognition="city", no_results=True)
event("page-a", "journey-e", "attempted", 3, requested_city="London", recognition="city", no_results=False)


def run(name):
    sql = (project / "docs/posthog" / name).read_text()
    sql = re.sub(r"\bproperties\.([a-z_]+)\b", r"json_extract(properties, '$.\1')", sql)
    sql = sql.replace("now() - INTERVAL 1 DAY", "'2026-10-21T00:00:00Z'").replace("now()", "'2026-10-22T00:00:00Z'")
    sql = sql.replace("lagInFrame(", "lag(")
    return [dict(row) for row in database.execute(sql)]


missing = run("missing-cities.sql")
assert {row["city"]: row["failed_attempts"] for row in missing} == {"Tokyo": 1, "Utrecht": 1, "Zurich": 1}, missing
followups = run("follow-up-searches.sql")
assert {(row["previous_search"], row["next_search"], row["transitions"]) for row in followups} == {
    ("Utrecht", "Amsterdam", 1), ("vancuver", "Vancouver", 1)}, followups
outcomes = run("search-outcomes.sql")
assert len(outcomes) == 6, outcomes
assert any(row["initial_search"] == "Utrecht" and row["outcome"] == "different city, same timezone" for row in outcomes), outcomes
assert any(row["initial_search"] == "Tokyo" and row["outcome"] == "closed without selection" for row in outcomes), outcomes
assert any(row["initial_search"] == "Zurich" and row["outcome"] == "same city selected" for row in outcomes), outcomes
assert any(row["initial_search"] == "vancuver" and row["outcome"] == "selection after unresolved search" for row in outcomes), outcomes
assert any(row["initial_search"] == "[text not recorded]" and row["outcome"] == "no outcome observed" for row in outcomes), outcomes
print("PASS: 3 report templates; missing-city counts, consecutive follow-ups, selection outcomes, duplicate and cross-journey isolation")
