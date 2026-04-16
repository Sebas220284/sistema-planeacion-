const { Pool } = require("pg");

// Agregamos este log para ver qué está pasando realmente en la consola de Railway
console.log("--- INTENTO DE CONEXIÓN DB ---");
console.log("HOST:", process.env.DB_HOST);
console.log("USER:", process.env.DB_USER);

const pool = new Pool({
  host: process.env.DB_HOST, // Si esto llega undefined, usará el default del driver que es 127.0.0.1
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // CRÍTICO PARA RAILWAY:
  ssl: process.env.DB_HOST && !process.env.DB_HOST.includes('localhost') 
    ? { rejectUnauthorized: false } 
    : false
});

module.exports = pool;