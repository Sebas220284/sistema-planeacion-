<<<<<<< HEAD
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const envPath = path.resolve(__dirname, "../../.env");

const result = require("dotenv").config({
  path: envPath,
  override: true,
});

if (result.error) {
  console.error("No se pudo cargar el .env:", result.error);
}

const password = process.env.DB_PASSWORD || "";

console.log("Diagnóstico de conexión:", {
  envPath,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  passwordExiste: password.length > 0,
  passwordLength: password.length,

  // No muestra la contraseña; solo permite comparar si cambió.
  passwordHash: crypto
    .createHash("sha256")
    .update(password)
    .digest("hex")
    .substring(0, 10),
});

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false,
  },
  connectionTimeoutMillis: 15000,
});

pool.on("error", (error) => {
  console.error("Error inesperado PostgreSQL:", error.message);
});

module.exports = pool;
=======
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
>>>>>>> 85dc65b99210683d4dda0138cacc86e9a202110e
