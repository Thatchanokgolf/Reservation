-- Remove duplicate fitness reservations where the same person (name + room,
-- case-insensitive) booked the same time slot more than once. Keeps the
-- earliest row (lowest id). Run once before the unique index can be created.

DELETE FROM fitness_reservations a
USING fitness_reservations b
WHERE a.id > b.id
  AND a.date = b.date
  AND a.hour = b.hour
  AND lower(a.name) = lower(b.name)
  AND lower(a.room) = lower(b.room);
