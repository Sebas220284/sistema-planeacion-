const { Pool } = require("pg");

// LOG DE DIAGNÓSTICO PROFESIONAL
console.log("--- REVISIÓN DE VARIABLES EN PRODUCCIÓN ---");
console.log("DB_HOST existe?:", !!process.env.DB_HOST);
console.log("Valor de DB_HOST:", process.env.DB_HOST || "NO DEFINIDO (Usando default 127.0.0.1)");
console.log("DB_USER existe?:", !!process.env.DB_USER);
console.log("-------------------------------------------");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_HOST && !process.env.DB_HOST.includes('localhost') 
    ? { rejectUnauthorized: false } 
    : false
});

module.exports = pool;