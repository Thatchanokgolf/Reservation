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
      machine     INTEGER     NOT NULL,
      date        TEXT        NOT NULL,
      hour        INTEGER     NOT NULL,
      name        TEXT        NOT NULL,
      room        TEXT        NOT NULL,
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
        SELECT machine, date, hour, name, room
        FROM reservations
        ORDER BY date, hour, machine
      `;
      return json({ reservations: rows });
    }

    // ---- Create a reservation ----
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const machine = Number(body.machine);
      const date = String(body.date || "");
      const hour = Number(body.hour);
      const name = String(body.name || "").trim();
      const room = String(body.room || "").trim();

      // Basic validation
      if (![1, 2].includes(machine)) return json({ error: "Invalid machine." }, 400);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "Invalid date." }, 400);
      if (!Number.isInteger(hour) || hour < 0 || hour > 23)
        return json({ error: "Invalid hour." }, 400);
      if (!name || !room) return json({ error: "Name and Room No. are required." }, 400);

      try {
        const [row] = await sql`
          INSERT INTO reservations (machine, date, hour, name, room)
          VALUES (${machine}, ${date}, ${hour}, ${name}, ${room})
          RETURNING machine, date, hour, name, room
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
