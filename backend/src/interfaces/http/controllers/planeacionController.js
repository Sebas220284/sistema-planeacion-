const PostgresPlanningRepository = require("../../../infrastructure/repositories/PostgresPlanningRepository")
const GetPlaneacionDashboard = require("../../../application/use-cases/GetPlaneacionDashboard")
const pool = require("../../../database/postgres")

const repository = new PostgresPlanningRepository()

exports.dashboard = async (req, res) => {
  try {
    const userId = req.query.user_id 
    let dependenciasQuery = `SELECT * FROM dependencies ORDER BY name`
    let params = []

    if (userId) {
      const userCheck = await pool.query(`SELECT acceso_restringido FROM users WHERE id=$1`, [userId])
      const restringido = userCheck.rows[0]?.acceso_restringido

      if (restringido) {
        dependenciasQuery = `
          SELECT d.* FROM dependencies d
          JOIN user_dependencias_asignadas uda ON uda.dependency_id = d.id
          WHERE uda.user_id = $1
          ORDER BY d.name
        `
        params = [userId]
      }
    }

    const depsResult = await pool.query(dependenciasQuery, params)
    const dependencias = depsResult.rows

    

    const resultado = []
    for (const dep of dependencias) {
      const estrategiasResult = await pool.query(`
        SELECT s.*, json_agg(
          json_build_object('id', pt.id, 'lineas_accion', pt.lineas_accion,'unidad_medida', pt.unidad_medida)
        ) FILTER (WHERE pt.id IS NOT NULL) as lineas
        FROM strategies s
        LEFT JOIN planning_templates pt ON pt.strategy_id = s.id AND pt.dependency_id = $1
        WHERE s.dependency_id = $1
        GROUP BY s.id
      `, [dep.id])

      const estrategias = {}
      estrategiasResult.rows.forEach(e => {
        estrategias[e.id] = { id: e.id, name: e.name, lineas: e.lineas || [] }
      })

      resultado.push({ ...dep, estrategias })
    }

    res.json(resultado)
  } catch(e) {
    console.error("Error dashboard:", e)
    res.status(500).json({ error: e.message })
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


