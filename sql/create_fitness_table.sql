-- Run this in the SAME Neon database used by the washing-machine app
-- (the one connected via NETLIFY_DATABASE_URL). This adds a second table
-- alongside the existing `reservations` table.
-- Each time slot (date + hour) can hold up to 3 reservations; capacity is
-- enforced in the function, so no UNIQUE constraint here.

CREATE TABLE IF NOT EXISTS fitness_reservations (
  id          SERIAL PRIMARY KEY,
  date        TEXT        NOT NULL,
  hour        INTEGER     NOT NULL,
  name        TEXT        NOT NULL,
  room        TEXT        NOT NULL,
  phone       TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful index for the per-slot capacity count.
CREATE INDEX IF NOT EXISTS idx_fitness_slot ON fitness_reservations (date, hour);

-- Prevent the same person (name + room, case-insensitive) from booking the
-- same time slot more than once.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_fitness_person_slot
  ON fitness_reservations (date, hour, lower(name), lower(room));
