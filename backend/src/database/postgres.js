const { Pool } = require("pg");

// Log para verificar en Railway qué está leyendo (No imprimas el Password por seguridad)
console.log("Intentando conectar a DB en:", process.env.DB_HOST);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // ESTO ES VITAL PARA RAILWAY
  ssl: process.env.DB_HOST && !process.env.DB_HOST.includes('localhost') 
    ? { rejectUnauthorized: false } 
    : false
});

async function testDB() {
  try {
    // Si DB_HOST es undefined, lanzamos error antes de intentar conectar
    if (!process.env.DB_HOST) {
      throw new Error("La variable DB_HOST no está definida en el entorno.");
    }

    const res = await pool.query("SELECT NOW()");
    console.log("✅ Conexión exitosa a Postgres:", res.rows[0]);
  } catch (err) {
    console.error("❌ ERROR CRÍTICO DE CONEXIÓN:", err.message);
  }
}

testDB();

module.exports = pool;