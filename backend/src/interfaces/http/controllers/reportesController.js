const pool = require("../../../database/postgres")

exports.programadoEjecutado = async (req, res) => {
  try {
    const anio = req.query.anio || new Date().getFullYear()

    const r = await pool.query(`
      SELECT
        d.name AS dependencia,
        pt.id AS linea_id,
        pt.lineas_accion,
        pt.nombre2,
        pt.pmd_eje, pt.pmd_tema, pt.pmd_objetivo, pt.pmd_estrategia,
        pt.unidad_medida,
        tr.trimestre,
        tr.tipo,
        tr.valor,
        tr.estado_revision,
        tr.estado_envio
      FROM planning_templates pt
      JOIN dependencies d ON d.id = pt.dependency_id
      LEFT JOIN planning_trimestres tr
        ON tr.planning_id = pt.id AND tr.anio = $1
      WHERE pt.ejercicio = $1 OR pt.ejercicio IS NULL
      ORDER BY d.name, pt.lineas_accion, tr.trimestre, tr.tipo
    `, [anio])

    // Reestructura: una fila por línea de acción, con T1..T4 programado/ejecutado
    const mapa = new Map()

    for (const row of r.rows) {
      const key = row.linea_id
      if (!mapa.has(key)) {
        mapa.set(key, {
          dependencia: row.dependencia,
          linea_accion: row.lineas_accion || row.nombre2 || "-",
          eje: row.pmd_eje, tema: row.pmd_tema,
          objetivo: row.pmd_objetivo, estrategia: row.pmd_estrategia,
          unidad_medida: row.unidad_medida,
          t1_programado:0, t1_ejecutado:0,
          t2_programado:0, t2_ejecutado:0,
          t3_programado:0, t3_ejecutado:0,
          t4_programado:0, t4_ejecutado:0,
          total_programado:0, total_ejecutado:0,
        })
      }
      const item = mapa.get(key)
      if (row.trimestre && row.tipo && row.valor !== null) {
        const campo = `t${row.trimestre}_${row.tipo}`
        if (campo in item) {
          item[campo] = Number(row.valor)
          item[`total_${row.tipo}`] += Number(row.valor)
        }
      }
    }

    res.json({ anio, filas: Array.from(mapa.values()) })
  } catch(e) {
    console.error("Error reporte global:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.aniosDisponibles = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT DISTINCT anio FROM planning_trimestres ORDER BY anio DESC
    `)
    res.json(r.rows.map(x => x.anio))
  } catch(e) { res.status(500).json({ error: e.message }) }
}