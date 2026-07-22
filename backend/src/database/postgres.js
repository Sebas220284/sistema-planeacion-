
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
 // ssl: {
  //  rejectUnauthorized: false
 // }
});

console.log("Intentando conectar a DB en:", process.env.DB_HOST || "ERROR: VARIABLE VACÍA");
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

  } catch (err) {
    console.error("DB ERROR:", err)
  }
  const res = await pool.query(`
SELECT 
current_database(),
current_user,
inet_server_addr(),
inet_server_port()
`)
console.log(res.rows)
}

testDB()

module.exports = pool