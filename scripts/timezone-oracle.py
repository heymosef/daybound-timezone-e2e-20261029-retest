"""Read the compiled IANA TZif files independently of js-joda and its builder."""
import json
from datetime import datetime
from pathlib import Path
import sys
from zoneinfo import ZoneInfo

root = Path(sys.argv[1]).resolve()
zones = {}
samples = []
for probe in json.load(sys.stdin):
    name = probe["zone"]
    target = (root / name).resolve()
    if not target.is_relative_to(root):
        raise ValueError("Timezone path escapes compiled data")
    if name not in zones:
        with target.open("rb") as source:
            zones[name] = ZoneInfo.from_file(source, key=name)
    local = datetime.fromisoformat(probe["instant"].replace("Z", "+00:00")).astimezone(zones[name])
    samples.append({**probe, "offsetSeconds": int(local.utcoffset().total_seconds()),
                    "date": local.strftime("%Y-%m-%d"), "hour": local.hour,
                    "minute": local.minute, "second": local.second})
json.dump(samples, sys.stdout, separators=(",", ":"))
