const PostgresPlanningRepository = require("../../../infrastructure/repositories/PostgresPlanningRepository")
const GetPlaneacionDashboard = require("../../../application/use-cases/GetPlaneacionDashboard")
const pool = require("../../../database/postgres")

const repository = new PostgresPlanningRepository()

exports.dashboard = async (req, res) => {

try{

const useCase = new GetPlaneacionDashboard(repository)

const data = await useCase.execute()

res.json(data)

}catch(error){

console.error(error)

res.status(500).json({
error:"Error obteniendo dashboard de planeación"
})

}

}

exports.reportes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        d.id as dep_id,
        d.name as dependencia,
        pt.anio,
        pt.trimestre,
        pt.tipo,
        SUM(pt.valor) as total_valor,
        COUNT(pt.id) as total_registros,
        COUNT(CASE WHEN pt.estado_revision = 'aprobado' THEN 1 END) as aprobados,
        COUNT(CASE WHEN pt.estado_revision = 'rechazado' THEN 1 END) as rechazados,
        COUNT(CASE WHEN pt.estado_revision = 'pendiente' THEN 1 END) as pendientes
      FROM dependencies d
      JOIN planning_templates p ON p.dependency_id = d.id
      JOIN planning_trimestres pt ON pt.planning_id = p.id
      GROUP BY d.id, d.name, pt.anio, pt.trimestre, pt.tipo
      ORDER BY d.name, pt.anio, pt.trimestre
    `)
    res.json(result.rows)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error obteniendo reportes" })
  }
}