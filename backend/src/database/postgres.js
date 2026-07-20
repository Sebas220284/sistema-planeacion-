const { Pool } = require("pg");

const pool = new Pool(
  process.env.DATABASE_URL 
    ? { 
        connectionString: process.env.DATABASE_URL,
        // Uncomment the following line if your database requires SSL (common in Railway outside private networking):
        // ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || "5432"),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
      }
);

console.log("Intentando conectar a DB en:", process.env.DATABASE_URL ? "URL proporcionada por Railway" : (process.env.DB_HOST || "ERROR: VARIABLE VACÍA"));
async function testDB() {
  try {
    const db = await pool.query("SELECT current_database()")
    console.log("DATABASE:", db.rows)

    const tables = await pool.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name='users'
    `)

    console.log("TABLES:", tables.rows)

    const res = await pool.query(`
SELECT 
current_database(),
current_user,
inet_server_addr(),
inet_server_port()
`)
    console.log(res.rows)

  } catch (err) {
    console.error("DB ERROR:", err)
  }
}

testDB()

module.exports = pool
