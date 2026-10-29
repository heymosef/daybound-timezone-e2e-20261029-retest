-- Template: confirmed unique catalogue cities with no picker or already-added results.
-- Last day is a report filter, NOT a deletion/retention policy. Widen after checking volume.
WITH missing AS (
    SELECT DISTINCT distinct_id, properties.search_id AS search_id,
        toInt(properties.attempt) AS attempt,
        properties.requested_city AS city, properties.requested_country AS country,
        properties.requested_region AS region, properties.requested_timezone AS timezone
    FROM events
    WHERE event = 'timezone_search_attempted' AND properties.search_version = 2
        AND properties.missing_city = true
        AND timestamp >= now() - INTERVAL 1 DAY AND timestamp < now()
)
SELECT city, country, region, timezone, count() AS failed_attempts
FROM missing
GROUP BY city, country, region, timezone
ORDER BY failed_attempts DESC
LIMIT 100
