const pool = require("../../../database/postgres")

const ESTADO_CFG = {
  completo:   { color:"#16a34a", bg:"#d1fae5", borde:"#6ee7b7", label:"Completo"   },
  en_proceso: { color:"#d97706", bg:"#fef3c7", borde:"#fcd34d",  label:"En proceso" },
  sin_avance: { color:"#dc2626", bg:"#fee2e2", borde:"#fca5a5",  label:"Sin avance"  },
  sin_lineas: { color:"#6b7280", bg:"#f3f4f6", borde:"#e5e7eb",  label:"Sin líneas"  },
}

exports.getPanelLlenado = async (req, res) => {
  try {
    const { anio, estado, busqueda } = req.query

    let where   = "WHERE 1=1"
    const params = []

    if (estado) {
      params.push(estado)
      where += ` AND estado_llenado=$${params.length}`
    }
    if (busqueda) {
      params.push(`%${busqueda}%`)
      where += ` AND dependencia_nombre ILIKE $${params.length}`
    }

    const deps = await pool.query(`
      SELECT * FROM v_poa_llenado_dependencias
      ${where}
      ORDER BY
        CASE estado_llenado
          WHEN 'sin_avance' THEN 1
          WHEN 'en_proceso' THEN 2
          WHEN 'completo'   THEN 3
          WHEN 'sin_lineas' THEN 4
        END,
        pct_llenado DESC NULLS LAST
    `, params)

    const stats = await pool.query(`
      SELECT
        COUNT(*)::int                                         AS total_dependencias,
        COUNT(*) FILTER (WHERE estado_llenado='completo')::int   AS completas,
        COUNT(*) FILTER (WHERE estado_llenado='en_proceso')::int AS en_proceso,
        COUNT(*) FILTER (WHERE estado_llenado='sin_avance')::int AS sin_avance,
        COUNT(*) FILTER (WHERE estado_llenado='sin_lineas')::int AS sin_lineas,
        SUM(total_lineas)::int                                AS total_lineas,
        SUM(lineas_con_avance)::int                           AS total_con_avance,
        SUM(lineas_sin_avance)::int                           AS total_sin_avance,
        SUM(lineas_completas)::int                            AS total_completas,
        ROUND(AVG(pct_llenado)::NUMERIC,2)                   AS pct_llenado_global,
        SUM(total_programado)                                 AS total_programado,
        SUM(total_ejecutado)                                  AS total_ejecutado
      FROM v_poa_llenado_dependencias
    `)

    const porTrimestre = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE ejec_t1 > 0)::int AS deps_con_t1,
        COUNT(*) FILTER (WHERE ejec_t2 > 0)::int AS deps_con_t2,
        COUNT(*) FILTER (WHERE ejec_t3 > 0)::int AS deps_con_t3,
        COUNT(*) FILTER (WHERE ejec_t4 > 0)::int AS deps_con_t4,
        COUNT(*)::int                             AS total_deps
      FROM v_poa_llenado_dependencias
      WHERE total_lineas > 0
    `)

    res.json({
      generado:      new Date().toISOString(),
      dependencias:  deps.rows.map(d => ({
        ...d,
        estado_info: ESTADO_CFG[d.estado_llenado] || ESTADO_CFG.sin_avance
      })),
      stats:         stats.rows[0],
      por_trimestre: porTrimestre.rows[0],
      estado_cfg:    ESTADO_CFG,
      total:         deps.rows.length
    })
  } catch(e) {
    console.error("Error panel llenado POA:", e)
    res.status(500).json({ error: e.message })
  }
}


exports.getDetalleDependencia = async (req, res) => {
  try {
    const { dep_id } = req.params

    const depInfo = await pool.query(`
      SELECT * FROM v_poa_llenado_dependencias
      WHERE dependency_id=$1
    `, [dep_id])

    const estrategias = await pool.query(`
      SELECT * FROM v_poa_llenado_estrategias
      WHERE dependency_id=$1
      ORDER BY pct_llenado DESC
    `, [dep_id])

    const lineas = await pool.query(`
      SELECT
        pt.id,
        pt.lineas_accion,
        pt.nomenclatura,
        pt.unidad_medida,
        pt.strategy_id,
        s.name AS strategy_nombre,
        -- T1
        COALESCE(SUM(tr.valor)
          FILTER (WHERE tr.tipo='programado' AND tr.trimestre=1),0) AS prog_t1,
        COALESCE(SUM(tr.valor)
          FILTER (WHERE tr.tipo='ejecutado'  AND tr.trimestre=1),0) AS ejec_t1,
        -- T2
        COALESCE(SUM(tr.valor)
          FILTER (WHERE tr.tipo='programado' AND tr.trimestre=2),0) AS prog_t2,
        COALESCE(SUM(tr.valor)
          FILTER (WHERE tr.tipo='ejecutado'  AND tr.trimestre=2),0) AS ejec_t2,
        -- T3
        COALESCE(SUM(tr.valor)
          FILTER (WHERE tr.tipo='programado' AND tr.trimestre=3),0) AS prog_t3,
        COALESCE(SUM(tr.valor)
          FILTER (WHERE tr.tipo='ejecutado'  AND tr.trimestre=3),0) AS ejec_t3,
        -- T4
        COALESCE(SUM(tr.valor)
          FILTER (WHERE tr.tipo='programado' AND tr.trimestre=4),0) AS prog_t4,
        COALESCE(SUM(tr.valor)
          FILTER (WHERE tr.tipo='ejecutado'  AND tr.trimestre=4),0) AS ejec_t4,
        -- Trimestres que ya llenaron
        COUNT(tr.id)
          FILTER (WHERE tr.tipo='ejecutado' AND tr.valor >= 0)::int AS trimestres_llenados,
        -- Estado de llenado de la línea
        CASE
          WHEN COUNT(tr.id) FILTER (WHERE tr.tipo='ejecutado') = 0
            THEN 'sin_avance'
          WHEN COUNT(tr.id) FILTER (WHERE tr.tipo='ejecutado') >= 4
            THEN 'completo'
          ELSE 'en_proceso'
        END AS estado_linea,
        MAX(tr.updated_at) AS ultima_actualizacion
      FROM planning_templates pt
      LEFT JOIN strategies s ON s.id = pt.strategy_id
      LEFT JOIN planning_trimestres tr ON tr.planning_id = pt.id
      WHERE pt.dependency_id=$1
      GROUP BY pt.id, pt.lineas_accion, pt.nomenclatura,
               pt.unidad_medida, pt.strategy_id, s.name
      ORDER BY s.name, pt.nomenclatura
    `, [dep_id])

    res.json({
      dependencia:  depInfo.rows[0]
        ? { ...depInfo.rows[0], estado_info: ESTADO_CFG[depInfo.rows[0].estado_llenado] }
        : null,
      estrategias:  estrategias.rows.map(e => ({
        ...e,
        estado_info: ESTADO_CFG[e.estado] || ESTADO_CFG.sin_avance
      })),
      lineas:       lineas.rows.map(l => ({
        ...l,
        estado_info: ESTADO_CFG[l.estado_linea] || ESTADO_CFG.sin_avance
      })),
      estado_cfg:   ESTADO_CFG
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
}


exports.getExportData = async (req, res) => {
  try {
    const deps = await pool.query(`
      SELECT * FROM v_poa_llenado_dependencias
      ORDER BY estado_llenado, pct_llenado DESC
    `)

    const estrategias = await pool.query(`
      SELECT * FROM v_poa_llenado_estrategias
      ORDER BY dependency_id, pct_llenado DESC
    `)

    const stats = await pool.query(`
      SELECT
        COUNT(*)::int                                           AS total_dependencias,
        COUNT(*) FILTER (WHERE estado_llenado='completo')::int  AS completas,
        COUNT(*) FILTER (WHERE estado_llenado='en_proceso')::int AS en_proceso,
        COUNT(*) FILTER (WHERE estado_llenado='sin_avance')::int AS sin_avance,
        SUM(total_lineas)::int                                  AS total_lineas,
        SUM(lineas_con_avance)::int                             AS con_avance,
        ROUND(AVG(pct_llenado)::NUMERIC,2)                     AS pct_global
      FROM v_poa_llenado_dependencias
    `)

    res.json({
      dependencias:    deps.rows.map(d => ({
        ...d,
        estado_info: ESTADO_CFG[d.estado_llenado]
      })),
      estrategias:     estrategias.rows,
      stats:           stats.rows[0],
      generado:        new Date().toISOString(),
      estado_cfg:      ESTADO_CFG
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
}