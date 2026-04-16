const { Pool } = require("pg")

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1' 
    ? { rejectUnauthorized: false } 
    : false
})

async function testDB() {
  try {
    const db = await pool.query("SELECT current_database()")
    console.log("✅ CONECTADO A:", db.rows[0].current_database)

    const res = await pool.query(`
      SELECT 
      current_database(),
      current_user,
      inet_server_addr(),
      inet_server_port()
    `)
    console.table(res.rows) 

  } catch (err) {
    console.error("❌ DB ERROR:", err.message)
  }
}

testDB()

module.exports = pool