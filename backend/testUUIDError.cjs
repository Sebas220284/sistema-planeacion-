const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function run() {
    try {
        await pool.query(`
            SELECT dependency_id
            FROM user_dependencias_asignadas
            WHERE user_id = 1
        `);
        console.log("Success");
    } catch(e) {
        console.error("Error:", e.message);
    }
    pool.end();
}
run();
