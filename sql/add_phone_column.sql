-- Add a phone number column to existing reservations tables.
-- Safe to run once against the Neon database. Existing rows get an empty
-- string. IF NOT EXISTS makes it a no-op if the column is already present.

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT '';
