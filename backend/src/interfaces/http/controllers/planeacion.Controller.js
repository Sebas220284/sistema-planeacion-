const pool = require("../../../database/postgres")

exports.revisarTrimestre = async(req,res)=>{

const io = req.app.get("io")

const {estado,comentario,user_id} = req.body

try{

const result = await pool.query(

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
[estado,comentario,user_id,req.params.id]

)

io.emit("revision_trimestre",result.rows[0])

res.json(result.rows[0])

}catch(error){

console.error(error)
res.status(500).json({error:"Error revisando trimestre"})

}

}

exports.dashboardPlaneacion = async(req,res)=>{

try{

const result = await pool.query(

`
SELECT

p.id,
d.name as dependencia,
s.name as estrategia,

p.lineas_accion,
p.responsable,

t.id as trimestre_id,
t.anio,
t.trimestre,
t.tipo,
t.valor,

t.estado_revision,
t.comentario_revision

FROM planning_templates p

LEFT JOIN dependencies d
ON d.id = p.dependency_id

LEFT JOIN strategies s
ON s.id = p.strategy_id

LEFT JOIN planning_trimestres t
ON t.planning_id = p.id

ORDER BY dependencia,anio,trimestre
`
)

res.json(result.rows)

}catch(error){

console.error(error)
res.status(500).json({error:"Error cargando dashboard"})

}

}