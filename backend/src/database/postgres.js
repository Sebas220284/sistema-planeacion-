const { Pool } = require("pg");

const REQUERIDAS = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const faltan = REQUERIDAS.filter((n) => !process.env[n]);
if (faltan.length) {
  console.error(`[DB] Faltan variables de entorno: ${faltan.join(", ")}`);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, 
  keepAlive: true,
});

pool.on("error", (err) => {
  console.error("[DB] Error en conexión inactiva:", err.code || "", err.message);
});

console.log("Intentando conectar a DB en:", process.env.DB_HOST || "ERROR: VARIABLE VACÍA");

async function testDB() {
  try {
    const db = await pool.query("SELECT current_database()");
    console.log("DATABASE:", db.rows);

    const tables = await pool.query(`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_name='users'
    `);
    console.log("TABLES:", tables.rows);

    const res = await pool.query(`
      SELECT current_database(), current_user, inet_server_addr(), inet_server_port()
    `);
    console.log(res.rows);
  } catch (err) {
    console.error("[DB] No se pudo conectar:", err.code || "", err.message);
  }
}

testDB();

module.exports = pool;