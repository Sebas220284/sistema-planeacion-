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