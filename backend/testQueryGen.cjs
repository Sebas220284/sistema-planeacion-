const fs = require('fs');

const user_id = "2905483f-7598-45e1-a5fa-b40c4254de7b";
const estado = "borrador";
const anio = 2027;

let where   = "WHERE costo_total > 0";
const params = [];

if (user_id) {
    params.push(user_id);
    where += ` AND dependency_id IN (
        SELECT dependency_id
        FROM user_dependencias_asignadas
        WHERE user_id = $${params.length}
    )`;
}

if (estado) {
    params.push(estado)
    where += ` AND estado = $${params.length}`
}
if (anio) {
    params.push(Number(anio))
    where += ` AND anio = $${params.length}`
}

let cipWhere = "1=1";
const calParams = [];
let userFilter = "";
if (user_id) {
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

if (estado && estado !== 'todos') {
    calParams.push(estado);
    cipWhere += ` AND c.estado = $${calParams.length}`;
}
if (anio && anio !== 'todos') {
    calParams.push(Number(anio));
    cipWhere += ` AND c.anio = $${calParams.length}`;
}

console.log("--- DETALLE / TOTALES WHERE ---");
console.log(where);
console.log("Params:", params);
console.log("\n--- RESUMEN QUERIES ---");
console.log("cipWhere:", cipWhere);
console.log("userFilter:", userFilter);
console.log("calParams:", calParams);
