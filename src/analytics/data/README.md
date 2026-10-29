# Analytics city catalogue

GeoNames cities15000, downloaded 2026-10-22. Source, checksum and record count are
in source.json. License: [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).
Attribution: [GeoNames](https://www.geonames.org/), [data documentation](https://download.geonames.org/export/dump/readme.txt).

Derived fields retain only city ID/name, country, timezone, administrative code
and ASCII spelling. Coordinates, population and arbitrary alternate names are
not shipped. The source covers larger cities/capitals, not every populated place.
Exact name/ASCII matches are used; ambiguous names are never silently assigned
to the largest city. Existing picker aliases remain authoritative for selections.

This catalogue classifies analytics only; it does not add cities to the picker.
It loads small initial-letter partitions from the application's own static assets only when analytics is enabled
and search is used. No user query is sent to GeoNames. To update, download the zip
and run `python3 scripts/update-city-catalog.py path/to/cities15000.zip`, review the
data diff, update the download date and run the search tests.
