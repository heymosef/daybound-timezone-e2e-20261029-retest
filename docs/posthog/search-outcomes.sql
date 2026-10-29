-- First observed failed attempt and eventual selection, one row per search journey.
-- A different city in the same timezone is a possible workaround, not confirmed success.
WITH failed AS (
    SELECT distinct_id, properties.search_id AS search_id,
        coalesce(properties.requested_city, properties.filtered_query, '[text not recorded]') AS initial_search,
        properties.requested_city_id AS requested_city_id,
        properties.requested_timezone AS requested_timezone,
        row_number() OVER (PARTITION BY distinct_id, properties.search_id
            ORDER BY toInt(properties.attempt), timestamp) AS failure_rank
    FROM events
    WHERE event = 'timezone_search_attempted' AND properties.search_version = 2
        AND properties.no_results = true
        AND timestamp >= now() - INTERVAL 1 DAY AND timestamp < now()
), choices AS (
    SELECT distinct_id, properties.search_id AS search_id,
        properties.selected_city AS selected_city, properties.selected_country AS selected_country,
        properties.selected_city_id AS selected_city_id, properties.selected_timezone AS selected_timezone,
        row_number() OVER (PARTITION BY distinct_id, properties.search_id
            ORDER BY toInt(properties.attempt) DESC, timestamp DESC) AS selection_rank
    FROM events
    WHERE event = 'timezone_search_selected' AND properties.search_version = 2
        AND timestamp >= now() - INTERVAL 1 DAY AND timestamp < now()
), closed AS (
    SELECT DISTINCT distinct_id, properties.search_id AS search_id
    FROM events
    WHERE event = 'timezone_search_closed' AND properties.search_version = 2
        AND timestamp >= now() - INTERVAL 1 DAY AND timestamp < now()
)
SELECT failed.search_id, failed.initial_search, choices.selected_city, choices.selected_country,
    CASE
        WHEN choices.selected_city IS NULL AND closed.search_id IS NOT NULL THEN 'closed without selection'
        WHEN choices.selected_city IS NULL THEN 'no outcome observed'
        WHEN failed.requested_city_id = choices.selected_city_id THEN 'same city selected'
        WHEN failed.requested_timezone = choices.selected_timezone
            AND failed.requested_city_id IS NOT NULL AND choices.selected_city_id IS NOT NULL THEN 'different city, same timezone'
        WHEN failed.requested_timezone = choices.selected_timezone THEN 'same timezone, city uncertain'
        WHEN failed.requested_city_id IS NULL THEN 'selection after unresolved search'
        ELSE 'different city selected'
    END AS outcome
FROM (SELECT * FROM failed WHERE failure_rank = 1) AS failed
LEFT JOIN (SELECT * FROM choices WHERE selection_rank = 1) AS choices
    ON failed.distinct_id = choices.distinct_id AND failed.search_id = choices.search_id
LEFT JOIN closed ON failed.distinct_id = closed.distinct_id AND failed.search_id = closed.search_id
ORDER BY failed.search_id
LIMIT 100
