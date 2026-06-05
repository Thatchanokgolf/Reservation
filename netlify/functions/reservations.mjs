import { neon } from "@netlify/neon";

// neon() reads the NETLIFY_DATABASE_URL env var that Netlify DB provisions
// automatically. No config needed when the database is linked to the site.
const sql = neon();

let initialized = false;

// Create the table on first invocation (idempotent).
async function ensureTable() {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS reservations (
      id          SERIAL PRIMARY KEY,
      machine     TEXT        NOT NULL,
      date        TEXT        NOT NULL,
      hour        INTEGER     NOT NULL,
      name        TEXT        NOT NULL,
      room        TEXT        NOT NULL,
      phone       TEXT        NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (machine, date, hour)
    )
  `;
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

    // ---- Retrieve all reservations ----
    if (req.method === "GET") {
      const rows = await sql`
        SELECT machine, date, hour, name, room, phone
        FROM reservations
        ORDER BY date, hour, machine
      `;
      return json({ reservations: rows });
    }

    // ---- Create a reservation ----
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const machine = String(body.machine || "").trim();
      const date = String(body.date || "");
      const hour = Number(body.hour);
      const name = String(body.name || "").trim();
      const room = String(body.room || "").trim();
      const phone = String(body.phone || "").trim();

      // Basic validation. The set of valid machines lives in the frontend
      // (the MACHINES array); the backend just requires a non-empty name.
      if (!machine) return json({ error: "Invalid machine." }, 400);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "Invalid date." }, 400);
      if (!Number.isInteger(hour) || hour < 0 || hour > 23)
        return json({ error: "Invalid hour." }, 400);
      if (!name || !room) return json({ error: "Name and Room No. are required." }, 400);
      if (!/^\d{3}$/.test(room)) return json({ error: "Room No. must be a 3-digit number." }, 400);
      if (!phone) return json({ error: "Phone number is required." }, 400);

      try {
        const [row] = await sql`
          INSERT INTO reservations (machine, date, hour, name, room, phone)
          VALUES (${machine}, ${date}, ${hour}, ${name}, ${room}, ${phone})
          RETURNING machine, date, hour, name, room, phone
        `;
        return json({ reservation: row }, 201);
      } catch (e) {
        // Unique violation => slot already taken
        if (e.code === "23505") {
          return json({ error: "That slot is already reserved." }, 409);
        }
        throw e;
      }
    }

    return json({ error: "Method not allowed." }, 405);
  } catch (err) {
    console.error(err);
    return json({ error: "Server error." }, 500);
  }
};
