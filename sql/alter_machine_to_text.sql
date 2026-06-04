-- Change reservations.machine from INTEGER to TEXT (string).
-- Safe to run once against the Neon database.
-- The USING clause casts existing integer values to their text form
-- (e.g. 1 -> '1', 2 -> '2'). The UNIQUE(machine, date, hour) constraint
-- is preserved automatically across the type change.

ALTER TABLE reservations
  ALTER COLUMN machine TYPE TEXT
  USING machine::text;
