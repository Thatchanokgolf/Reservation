-- Remove leftover test/stale reservations whose machine identifier is not
-- one of the current valid machines (the MACHINES array in index.html).
-- Run once against the Neon database.

-- Optional: preview what will be deleted first.
-- SELECT machine, count(*) FROM reservations
--   WHERE machine NOT IN (
--     'Washing Machine 1 (Floor 9)',
--     'Washing Machine 2 (Floor 1)',
--     'Fitness Room'
--   )
--   GROUP BY machine;

DELETE FROM reservations
WHERE machine NOT IN (
  'Washing Machine 1 (Floor 9)',
  'Washing Machine 2 (Floor 1)',
  'Fitness Room'
);
