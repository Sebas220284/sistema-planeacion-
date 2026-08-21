const pool = require("../../../database/postgres")

const SEMAFORO_INFO = {
  optimo:    { color:"#16a34a", bg:"#d1fae5", emoji:"🟢", label:"Óptimo",    min:90  },
  bueno:     { color:"#d97706", bg:"#fef3c7", emoji:"🟡", label:"Bueno",     min:70  },
  regular:   { color:"#ea580c", bg:"#ffedd5", emoji:"🟠", label:"Regular",   min:50  },
  bajo:      { color:"#dc2626", bg:"#fee2e2", emoji:"🔴", label:"Bajo",      min:0   },
  sin_datos: { color:"#6b7280", bg:"#f3f4f6", emoji:"⚪", label:"Sin datos", min:null},
}

const enriquecer = (rows) => rows.map(r => ({
  ...r,
  semaforo_info:    SEMAFORO_INFO[r.semaforo]    || SEMAFORO_INFO.sin_datos,
  semaforo_t1_info: SEMAFORO_INFO[r.semaforo_t1] || SEMAFORO_INFO.sin_datos,
  semaforo_t2_info: SEMAFORO_INFO[r.semaforo_t2] || SEMAFORO_INFO.sin_datos,
  semaforo_t3_info: SEMAFORO_INFO[r.semaforo_t3] || SEMAFORO_INFO.sin_datos,
  semaforo_t4_info: SEMAFORO_INFO[r.semaforo_t4] || SEMAFORO_INFO.sin_datos,
}))


exports.getLineas = async (req, res) => {
  try {
    const {
      anio        = new Date().getFullYear(),
      dep_id,
      semaforo,
      trimestre,
      busqueda,
      pagina   = 1,
      limite   = 50
    } = req.query

    let where   = `WHERE total_programado > 0`
    const params = []

    if (anio) {
      params.push(Number(anio))
      where += ` AND anio = $${params.length}`
    }
    if (dep_id) {
      params.push(dep_id)
      where += ` AND dependency_id = $${params.length}`
    }
    if (semaforo) {
      params.push(semaforo)
      where += ` AND semaforo = $${params.length}`
    }
    if (busqueda) {
      params.push(`%${busqueda}%`)
      where += ` AND lineas_accion ILIKE $${params.length}`
    }

    const offset = (Number(pagina) - 1) * Number(limite)
    const total  = await pool.query(
      `SELECT COUNT(*) FROM v_semaforo_lineas ${where}`, params
    )

    const r = await pool.query(`
      SELECT *
      FROM v_semaforo_lineas
      ${where}
      ORDER BY
        CASE semaforo
          WHEN 'bajo'     THEN 1
          WHEN 'regular'  THEN 2
          WHEN 'bueno'    THEN 3
          WHEN 'optimo'   THEN 4
          ELSE 5
        END,
        dependencia_nombre, lineas_accion
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `, [...params, Number(limite), offset])

    res.json({
      lineas:      enriquecer(r.rows),
      total:       parseInt(total.rows[0].count),
      pagina:      Number(pagina),
      total_paginas: Math.ceil(parseInt(total.rows[0].count)/Number(limite))
    })
  } catch(e) {
    console.error("Error semáforo lineas:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.getResumenDependencias = async (req, res) => {
  try {
    const anio = req.query.anio || new Date().getFullYear()

    const r = await pool.query(`
      SELECT *,
        CASE
          WHEN cumplimiento_global >= 90 THEN 'optimo'
          WHEN cumplimiento_global >= 70 THEN 'bueno'
          WHEN cumplimiento_global >= 50 THEN 'regular'
          ELSE 'bajo'
        END AS semaforo_global
      FROM v_semaforo_dependencias
      WHERE anio = $1
      ORDER BY cumplimiento_global DESC
    `, [anio])

    const stats = await pool.query(`
      SELECT
        SUM(total_lineas)::int        AS total_lineas,
        SUM(lineas_optimo)::int       AS total_optimo,
        SUM(lineas_bueno)::int        AS total_bueno,
        SUM(lineas_regular)::int      AS total_regular,
        SUM(lineas_bajo)::int         AS total_bajo,
        SUM(lineas_sin_datos)::int    AS total_sin_datos,
        ROUND(AVG(cumplimiento_global)::NUMERIC,2) AS promedio_global
      FROM v_semaforo_dependencias
      WHERE anio = $1
    `, [anio])

    res.json({
      dependencias: r.rows.map(d => ({
        ...d,
        semaforo_info: SEMAFORO_INFO[d.semaforo_global] || SEMAFORO_INFO.sin_datos
      })),
      stats: stats.rows[0],
      semaforo_info: SEMAFORO_INFO
    })
  } catch(e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}


exports.getDetalleDependencia = async (req, res) => {
  try {
    const { dep_id } = req.params
    const anio = req.query.anio || new Date().getFullYear()

    const lineas = await pool.query(`
      SELECT * FROM v_semaforo_lineas
      WHERE dependency_id=$1 AND anio=$2
      ORDER BY porcentaje_cumplimiento ASC
    `, [dep_id, anio])

    const resumen = await pool.query(`
      SELECT * FROM v_semaforo_dependencias
      WHERE dependency_id=$1 AND anio=$2
    `, [dep_id, anio])

    // Distribución por estrategia
    const porEstrategia = await pool.query(`
      SELECT
        strategy_nombre,
        strategy_id,
        COUNT(*)::int AS total_lineas,
        ROUND(AVG(porcentaje_cumplimiento)::NUMERIC,2) AS pct_promedio,
        COUNT(*) FILTER (WHERE semaforo='optimo')::int  AS optimo,
        COUNT(*) FILTER (WHERE semaforo='bueno')::int   AS bueno,
        COUNT(*) FILTER (WHERE semaforo='regular')::int AS regular,
        COUNT(*) FILTER (WHERE semaforo='bajo')::int    AS bajo
      FROM v_semaforo_lineas
      WHERE dependency_id=$1 AND anio=$2
      GROUP BY strategy_nombre, strategy_id
      ORDER BY pct_promedio ASC
    `, [dep_id, anio])

    res.json({
      lineas:       enriquecer(lineas.rows),
      resumen:      resumen.rows[0] || {},
      por_estrategia: porEstrategia.rows,
      semaforo_info: SEMAFORO_INFO
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
}


exports.getAnios = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT DISTINCT anio FROM planning_trimestres
      WHERE anio IS NOT NULL ORDER BY anio DESC
    `)
    res.json(r.rows.map(x => x.anio))
  } catch(e) { res.status(500).json({ error: e.message }) }
}