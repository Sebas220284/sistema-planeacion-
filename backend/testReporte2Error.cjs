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
    const user_id = '954bee42-8636-4001-901a-9ca09f48707c';
    let cipWhere = "1=1";
    const calParams = [];
    let userFilter = "";
    
    try {
        const userRes = await pool.query(`SELECT r.name AS rol FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = $1`, [user_id]);
        if (userRes.rows.length > 0 && userRes.rows[0].rol === 'inversion_publica') {
            calParams.push(user_id);
            userFilter = ` AND d.id IN (
                SELECT 
                    CASE 
                        WHEN dependency_id IN ('ec6cf929-712e-44de-99fa-316043716114', '768ac9b7-b895-4a0c-b00f-462114fbc82e') THEN '11111111-1111-1111-1111-111111111101'::uuid
                        ELSE dependency_id
                    END
                FROM user_dependencias_asignadas 
                WHERE user_id = $${calParams.length}
            )`;
            cipWhere += ` AND c.dependency_id IN (SELECT dependency_id FROM user_dependencias_asignadas WHERE user_id = $${calParams.length})`;
        }

        const resumenQuery = `
        SELECT 
            d.id
        FROM dependencies d
        LEFT JOIN (
            SELECT 
                CASE 
                    WHEN c.dependency_id IN ('ec6cf929-712e-44de-99fa-316043716114', '768ac9b7-b895-4a0c-b00f-462114fbc82e') THEN '11111111-1111-1111-1111-111111111101'::uuid
                    ELSE c.dependency_id
                END as dep_id,
                COUNT(DISTINCT linea) AS total_lineas
            FROM cip_proyectos c
            LEFT JOIN LATERAL jsonb_array_elements_text(
                CASE 
                    WHEN jsonb_typeof(c.pmd_lineas_accion) = 'array' THEN c.pmd_lineas_accion 
                    ELSE '[]'::jsonb 
                END
            ) AS linea ON true
            WHERE ${cipWhere}
            GROUP BY dep_id
        ) pt_agg ON pt_agg.dep_id = d.id
        WHERE d.id NOT IN ('ec6cf929-712e-44de-99fa-316043716114', '768ac9b7-b895-4a0c-b00f-462114fbc82e') ${userFilter}
        `;
        const r = await pool.query(resumenQuery, calParams);
        console.log("Success");
    } catch(e) {
        console.error("Error:", e.message);
    }
    pool.end();
}
run();
