const pool = require("../../database/postgres")

class PostgresPlanningRepository {

async getPlaneacionDashboard(){

const result = await pool.query(`

SELECT 

d.id as dependencia_id,
d.name as dependencia,

s.id as estrategia_id,
s.name as estrategia,

p.id as linea_id,
p.pmd_eje,
p.pmd_tema,
p.pmd_politica_publica,
p.pmd_objetivo,
p.pmd_estrategia,
p.linea_base,
p.total,
p.ejercicio,
p.columna1,
p.lineas_accion,
p.nomenclatura,
p.nombre2,
p.responsable,
p.plazo,
p.estado,
p.comentario_planeacion

FROM dependencies d

LEFT JOIN strategies s
ON s.dependency_id = d.id

LEFT JOIN planning_templates p
ON p.strategy_id = s.id

ORDER BY d.name,s.name
`)

return result.rows

}

async aprobarLinea(id,usuario){

await pool.query(`
UPDATE planning_templates
SET estado='aprobado',
aprobado_por=$2,
fecha_revision=NOW()
WHERE id=$1
`,[id,usuario])

}

async rechazarLinea(id,comentario,usuario){

await pool.query(`
UPDATE planning_templates
SET estado='rechazado',
comentario_planeacion=$2,
aprobado_por=$3,
fecha_revision=NOW()
WHERE id=$1
`,[id,comentario,usuario])

}


async saveTrimestre(data){

const {
planning_id,
anio,
trimestre,
tipo,
valor,
comentario
} = data

const result = await this.pool.query(

`
INSERT INTO planning_trimestres
(planning_id,anio,trimestre,tipo,valor,comentario)

VALUES($1,$2,$3,$4,$5,$6)

ON CONFLICT(planning_id,anio,trimestre,tipo)

DO UPDATE SET
valor=EXCLUDED.valor,
comentario=EXCLUDED.comentario

RETURNING *
`,
[planning_id,anio,trimestre,tipo,valor,comentario]

)

return result.rows[0]

}

async reviewTrimestre(data){

const {id,estado,comentario,user_id} = data

const result = await this.pool.query(

`
UPDATE planning_trimestres
SET

estado_revision=$1,
comentario_revision=$2,
revisado_por=$3,
fecha_revision=NOW()

WHERE id=$4

RETURNING *
`,
[estado,comentario,user_id,id]

)

return result.rows[0]

}

}

module.exports = PostgresPlanningRepository