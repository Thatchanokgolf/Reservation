import { neon } from "@netlify/neon";

// Same Neon database as the washing-machine reservations (reads
// NETLIFY_DATABASE_URL), but stores fitness bookings in its own table.
const sql = neon();

// Each time slot (date + hour) can hold up to this many reservations.
const CAPACITY = 3;

let initialized = false;

async function ensureTable() {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS fitness_reservations (
      id          SERIAL PRIMARY KEY,
      date        TEXT        NOT NULL,
      hour        INTEGER     NOT NULL,
      name        TEXT        NOT NULL,
      room        TEXT        NOT NULL,
      phone       TEXT        NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  // Prevent the same person (name + room) from booking the same slot twice.
  // Case-insensitive so "Golf"/"golf" count as the same. Non-fatal: if legacy
  // duplicate rows exist the index can't be created yet, but the API must stay
  // up — the POST handler also checks for duplicates at the application level.
  try {
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_fitness_person_slot
      ON fitness_reservations (date, hour, lower(name), lower(room))
    `;
  } catch (e) {
    console.warn("uniq_fitness_person_slot not created (existing duplicates?):", e.detail || e.message);
  }
  initialized = true;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export default async (req) => {
  try {
    await ensureTable();

    // ---- Retrieve all reservations (no phone number returned) ----
    if (req.method === "GET") {
      const rows = await sql`
        SELECT date, hour, name, room
        FROM fitness_reservations
        ORDER BY date, hour
      `;
      return json({ reservations: rows });
    }

    // ---- Create a reservation (capacity-limited) ----
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const date = String(body.date || "");
      const hour = Number(body.hour);
      const name = String(body.name || "").trim();
      const room = String(body.room || "").trim();
      const phone = String(body.phone || "").trim();

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "Invalid date." }, 400);
      if (!Number.isInteger(hour) || hour < 8 || hour > 21)
        return json({ error: "Invalid hour." }, 400);
      if (!name || !room) return json({ error: "Name and Room No. are required." }, 400);
      if (!/^\d{3}$/.test(room)) return json({ error: "Room No. must be a 3-digit number." }, 400);
      if (!phone) return json({ error: "Phone number is required." }, 400);

      // Capacity check.
      const [{ count }] = await sql`
        SELECT count(*)::int AS count
        FROM fitness_reservations
        WHERE date = ${date} AND hour = ${hour}
      `;
      if (count >= CAPACITY) return json({ error: "This time slot is full.", code: "full" }, 409);

      // Application-level duplicate guard (the unique index is the race-safe backstop).
      const dup = await sql`
        SELECT 1 FROM fitness_reservations
        WHERE date = ${date} AND hour = ${hour}
          AND lower(name) = lower(${name}) AND lower(room) = lower(${room})
        LIMIT 1
      `;
      if (dup.length > 0)
        return json({ error: "You already have a reservation for this time slot.", code: "duplicate" }, 409);

      try {
        const [row] = await sql`
          INSERT INTO fitness_reservations (date, hour, name, room, phone)
          VALUES (${date}, ${hour}, ${name}, ${room}, ${phone})
          RETURNING date, hour, name, room
        `;
        return json({ reservation: row, remaining: CAPACITY - (count + 1) }, 201);
      } catch (e) {
        // Unique violation => same name + room already booked this slot.
        if (e.code === "23505") {
          return json({ error: "You already have a reservation for this time slot.", code: "duplicate" }, 409);
        }
        throw e;
      }
    }

    // ---- Delete a reservation ----
    if (req.method === "DELETE") {
      const body = await req.json().catch(() => ({}));
      const password = String(body.password || "");
      const date = String(body.date || "");
      const hour = Number(body.hour);
      const name = String(body.name || "").trim();
      const room = String(body.room || "").trim();

      if (password !== "delete") return json({ error: "Incorrect password." }, 403);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "Invalid date." }, 400);
      if (!Number.isInteger(hour)) return json({ error: "Invalid hour." }, 400);
      if (!name || !room) return json({ error: "Name and Room No. are required." }, 400);

      const result = await sql`
        DELETE FROM fitness_reservations
        WHERE date = ${date} AND hour = ${hour}
          AND lower(name) = lower(${name}) AND lower(room) = lower(${room})
        RETURNING id
      `;
      if (result.length === 0) return json({ error: "Reservation not found." }, 404);
      return json({ deleted: true });
    }

    return json({ error: "Method not allowed." }, 405);
  } catch (err) {
    console.error(err);
    return json({ error: "Server error." }, 500);
  }
};
