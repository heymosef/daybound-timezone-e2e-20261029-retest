-- Same anonymous page identity AND same search journey; never join unrelated searches.
WITH attempts AS (
    SELECT DISTINCT distinct_id, properties.search_id AS search_id,
        toInt(properties.attempt) AS attempt,
        coalesce(properties.requested_city, properties.filtered_query, '[text not recorded]') AS search,
        properties.recognition AS recognition, properties.requested_country AS country,
        properties.no_results AS no_results
    FROM events
    WHERE event = 'timezone_search_attempted' AND properties.search_version = 2
        AND timestamp >= now() - INTERVAL 1 DAY AND timestamp < now()
), ordered AS (
    SELECT *,
        lagInFrame(search, 1, '') OVER (
            PARTITION BY distinct_id, search_id ORDER BY attempt
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS previous_search,
        lagInFrame(attempt, 1, 0) OVER (
            PARTITION BY distinct_id, search_id ORDER BY attempt
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS previous_attempt,
        lagInFrame(no_results, 1, false) OVER (
            PARTITION BY distinct_id, search_id ORDER BY attempt
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS previous_no_results
    FROM attempts
)
SELECT previous_search, search AS next_search, recognition AS next_recognition,
    country AS next_country, count() AS transitions
FROM ordered
WHERE attempt = previous_attempt + 1 AND previous_no_results = true
GROUP BY previous_search, next_search, next_recognition, next_country
ORDER BY transitions DESC
LIMIT 100
