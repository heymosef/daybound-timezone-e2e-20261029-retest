"""Generate the analytics-only city catalogue from a GeoNames cities15000 zip.

Run explicitly, never during a product build. No searches are sent to GeoNames.
Usage: python3 scripts/update-city-catalog.py path/to/cities15000.zip
"""
import hashlib
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import unicodedata
import zipfile

source = Path(sys.argv[1])
project = Path(__file__).resolve().parent.parent
rows = []
with zipfile.ZipFile(source) as archive:
    for line in archive.read("cities15000.txt").decode("utf-8").splitlines():
        fields = line.split("\t")
        if len(fields) != 19 or not fields[8] or not fields[17]:
            continue
        # ID, standard name, country, timezone, administrative region, ASCII alias.
        rows.append([int(fields[0]), fields[1], fields[8], fields[17], fields[10],
                     fields[2] if fields[2] != fields[1] else ""])
rows.sort(key=lambda row: row[0])
destination = project / "src/analytics/data/cities"
destination.mkdir(parents=True, exist_ok=True)
shards = {}
for row in rows:
    keys = set()
    for name in (row[1], row[5]):
        if name:
            plain = "".join(ch for ch in unicodedata.normalize("NFKD", name) if not unicodedata.combining(ch)).lower()
            keys.add(plain[0] if "a" <= plain[0] <= "z" else "other")
    for key in keys:
        shards.setdefault(key, []).append(row)
for key, records in sorted(shards.items()):
    (destination / (key + ".json")).write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")) + "\n")
metadata = {"source": "https://download.geonames.org/export/dump/cities15000.zip",
            "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "records": len(rows),
            "license": "CC BY 4.0", "generated_on": datetime.now(timezone.utc).date().isoformat(), "shards": len(shards)}
(destination.parent / "source.json").write_text(json.dumps(metadata, indent=2) + "\n")
print(json.dumps({**metadata, "bytes": sum(p.stat().st_size for p in destination.glob("*.json"))}))
