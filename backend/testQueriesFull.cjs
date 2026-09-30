const { Pool } = require('pg');
require('dotenv').config();
const fs = require('fs');
const code = fs.readFileSync('src/interfaces/http/controllers/reportesCIPController.js', 'utf8');

const idx = code.indexOf('const resumenQuery =');
const end = code.indexOf('const resumen = await pool.query(resumenQuery, calParams);');
const resumenQueryStr = code.substring(idx, end).replace('const resumenQuery = `', '').replace(/`;\s*$/, '');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function run() {
    const user_id = '954bee42-8636-4001-901a-9ca09f48707c';
    let cipWhere = "1=1";
    const calParams = [];
    let userFilter = "";
    
    try {
        calParams.push(user_id);
        userFilter = ` AND d.id IN (
            SELECT 
                CASE 
                    WHEN dependency_id IN ('ec6cf929-712e-44de-99fa-316043716114', '768ac9b7-b895-4a0c-b00f-462114fbc82e') THEN '11111111-1111-1111-1111-111111111101'::uuid
                    ELSE dependency_id
                END
            FROM user_dependencias_asignadas 
            WHERE user_id = $1
        )`;
        cipWhere += ` AND c.dependency_id IN (SELECT dependency_id FROM user_dependencias_asignadas WHERE user_id = $1)`;

        let queryToRun = resumenQueryStr;
        queryToRun = queryToRun.replace(/\$\{cipWhere\}/g, cipWhere);
        queryToRun = queryToRun.replace(/\$\{userFilter\}/g, userFilter);

        const r = await pool.query(queryToRun, calParams);
        console.log("Success! Rows:", r.rows.length);
    } catch(e) {
        console.error("Error from resumenQuery:", e.message);
    }

    try {
        let where = "WHERE costo_total > 0";
        where += ` AND dependency_id IN (
            SELECT dependency_id
            FROM user_dependencias_asignadas
            WHERE user_id = $1
        )`;
        const r2 = await pool.query(`
          SELECT * FROM v_reporte_cip_trimestres
          ${where}
        `, [user_id]);
        console.log("Success detalle! Rows:", r2.rows.length);
    } catch(e) {
        console.error("Error from detalle query:", e.message);
    }

    try {
        let where = "WHERE costo_total > 0";
        where += ` AND dependency_id IN (
            SELECT dependency_id
            FROM user_dependencias_asignadas
            WHERE user_id = $1
        )`;
        const r3 = await pool.query(`
          SELECT
            COUNT(*)::int          AS total_cips,
            SUM(costo_total)       AS gran_total,
            SUM(monto_t1)          AS gran_total_t1,
            SUM(monto_t2)          AS gran_total_t2,
            SUM(monto_t3)          AS gran_total_t3,
            SUM(monto_t4)          AS gran_total_t4,
            COUNT(DISTINCT dependency_id)::int AS total_dependencias
          FROM v_reporte_cip_trimestres
          ${where}
        `, [user_id]);
        console.log("Success totales! Rows:", r3.rows.length);
    } catch(e) {
        console.error("Error from totales query:", e.message);
    }

    pool.end();
}
run();
