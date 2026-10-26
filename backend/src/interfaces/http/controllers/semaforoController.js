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


exports.getResumenEjes = async (req, res) => {
  try {
    const anio = Number(req.query.anio || new Date().getFullYear())

    const r = await pool.query(`
      WITH ei_stats AS (
        SELECT
          split_part(clave, '.', 1)::int AS eje_num,
          COUNT(DISTINCT clave)::int AS total_indicadores
        FROM estrategia_indicadores
        WHERE clave IS NOT NULL
        GROUP BY split_part(clave, '.', 1)::int
      ),
      strat_stats AS (
        SELECT
          split_part(clave, '.', 1)::int AS eje_num,
          COUNT(DISTINCT strategy_id)::int AS total_estrategias
        FROM v_estrategia_indicador
        WHERE clave IS NOT NULL
        GROUP BY split_part(clave, '.', 1)::int
      ),
      semaforo_eje AS (
        SELECT
          split_part(nomenclatura, '.', 1)::int AS eje_num,
          COUNT(*)::int AS total_lineas,
          COUNT(DISTINCT dependency_id)::int AS total_dependencias,
          COUNT(*) FILTER (WHERE semaforo = 'optimo')::int AS lineas_optimo,
          COUNT(*) FILTER (WHERE semaforo = 'bueno')::int AS lineas_bueno,
          COUNT(*) FILTER (WHERE semaforo = 'regular')::int AS lineas_regular,
          COUNT(*) FILTER (WHERE semaforo = 'bajo')::int AS lineas_bajo,
          COALESCE(SUM(total_programado), 0) AS total_programado,
          COALESCE(SUM(total_ejecutado), 0) AS total_ejecutado,
          COALESCE(ROUND(AVG(porcentaje_cumplimiento), 2), 0) AS cumplimiento_global
        FROM v_semaforo_lineas
        WHERE anio = $1 AND total_programado > 0
          AND split_part(nomenclatura, '.', 1) ~ '^[0-9]+$'
        GROUP BY split_part(nomenclatura, '.', 1)::int
      )
      SELECT
        pe.id AS eje_num,
        pe.nombre AS eje_nombre,
        pe.tipo_eje,
        pe.enfoque_principal,
        COALESCE(ei.total_indicadores, 0)::int AS total_indicadores,
        COALESCE(st.total_estrategias, 0)::int AS total_estrategias,
        COALESCE(se.total_dependencias, 0)::int AS total_dependencias,
        COALESCE(se.total_lineas, 0)::int AS total_lineas,
        COALESCE(se.lineas_optimo, 0)::int AS lineas_optimo,
        COALESCE(se.lineas_bueno, 0)::int AS lineas_bueno,
        COALESCE(se.lineas_regular, 0)::int AS lineas_regular,
        COALESCE(se.lineas_bajo, 0)::int AS lineas_bajo,
        COALESCE(se.total_programado, 0) AS total_programado,
        COALESCE(se.total_ejecutado, 0) AS total_ejecutado,
        COALESCE(se.cumplimiento_global, 0) AS cumplimiento_global,
        CASE
          WHEN COALESCE(se.total_lineas, 0) = 0 THEN 'sin_datos'
          WHEN COALESCE(se.cumplimiento_global, 0) >= 90 THEN 'optimo'
          WHEN COALESCE(se.cumplimiento_global, 0) >= 70 THEN 'bueno'
          WHEN COALESCE(se.cumplimiento_global, 0) >= 50 THEN 'regular'
          ELSE 'bajo'
        END AS semaforo_global
      FROM pmd_ejes pe
      LEFT JOIN ei_stats ei ON ei.eje_num = pe.id
      LEFT JOIN strat_stats st ON st.eje_num = pe.id
      LEFT JOIN semaforo_eje se ON se.eje_num = pe.id
      ORDER BY pe.id ASC
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

    const ejesEnriquecidos = r.rows.map(e => ({
      ...e,
      semaforo_info: SEMAFORO_INFO[e.semaforo_global] || SEMAFORO_INFO.sin_datos
    }))

    res.json({
      anio,
      ejes: ejesEnriquecidos,
      stats: {
        ...(stats.rows[0] || {}),
        total_ejes: ejesEnriquecidos.length,
        total_indicadores: ejesEnriquecidos.reduce((s, x) => s + Number(x.total_indicadores || 0), 0),
        total_estrategias: ejesEnriquecidos.reduce((s, x) => s + Number(x.total_estrategias || 0), 0),
      },
      semaforo_info: SEMAFORO_INFO
    })
  } catch (e) {
    console.error("Error semáforo ejes:", e)
    res.status(500).json({ error: e.message })
  }
}


exports.getDetalleEje = async (req, res) => {
  try {
    const ejeNum = parseInt(String(req.params.eje_num || "").split(".")[0])
    const anio = Number(req.query.anio || new Date().getFullYear())

    const ejeRes = await pool.query(`SELECT * FROM pmd_ejes WHERE id = $1`, [ejeNum])
    if (!ejeRes.rows[0]) {
      return res.status(404).json({ error: "Eje no encontrado" })
    }

    const estrategiasRes = await pool.query(`
      SELECT
        ei.clave,
        ei.indicador,
        COALESCE(ei.requiere_revision, false) AS requiere_revision,
        ei.nota,
        s.id AS strategy_id,
        s.name AS strategy_nombre,
        d.id AS dependency_id,
        d.name AS dependencia_nombre,
        COUNT(vsl.linea_id) FILTER (WHERE vsl.total_programado > 0)::int AS total_lineas,
        COUNT(vsl.linea_id) FILTER (WHERE vsl.semaforo = 'optimo')::int AS lineas_optimo,
        COUNT(vsl.linea_id) FILTER (WHERE vsl.semaforo = 'bueno')::int AS lineas_bueno,
        COUNT(vsl.linea_id) FILTER (WHERE vsl.semaforo = 'regular')::int AS lineas_regular,
        COUNT(vsl.linea_id) FILTER (WHERE vsl.semaforo = 'bajo')::int AS lineas_bajo,
        COALESCE(SUM(vsl.total_programado) FILTER (WHERE vsl.total_programado > 0), 0) AS total_programado,
        COALESCE(SUM(vsl.total_ejecutado) FILTER (WHERE vsl.total_programado > 0), 0) AS total_ejecutado,
        COALESCE(ROUND(AVG(vsl.porcentaje_cumplimiento) FILTER (WHERE vsl.total_programado > 0), 2), 0) AS cumplimiento_promedio,
        CASE
          WHEN COUNT(vsl.linea_id) FILTER (WHERE vsl.total_programado > 0) = 0 THEN 'sin_datos'
          WHEN COALESCE(ROUND(AVG(vsl.porcentaje_cumplimiento) FILTER (WHERE vsl.total_programado > 0), 2), 0) >= 90 THEN 'optimo'
          WHEN COALESCE(ROUND(AVG(vsl.porcentaje_cumplimiento) FILTER (WHERE vsl.total_programado > 0), 2), 0) >= 70 THEN 'bueno'
          WHEN COALESCE(ROUND(AVG(vsl.porcentaje_cumplimiento) FILTER (WHERE vsl.total_programado > 0), 2), 0) >= 50 THEN 'regular'
          ELSE 'bajo'
        END AS semaforo
      FROM estrategia_indicadores ei
      LEFT JOIN v_estrategia_indicador vei ON vei.clave = ei.clave
      LEFT JOIN strategies s ON s.id = vei.strategy_id
      LEFT JOIN dependencies d ON d.id = s.dependency_id
      LEFT JOIN v_semaforo_lineas vsl ON vsl.strategy_id = s.id AND vsl.anio = $2
      WHERE split_part(ei.clave, '.', 1)::int = $1
      GROUP BY ei.clave, ei.indicador, ei.requiere_revision, ei.nota, s.id, s.name, d.id, d.name
      ORDER BY string_to_array(ei.clave, '.')::int[], d.name
    `, [ejeNum, anio])

    const lineasRes = await pool.query(`
      SELECT *
      FROM v_semaforo_lineas
      WHERE split_part(nomenclatura, '.', 1)::int = $1
        AND anio = $2
        AND total_programado > 0
      ORDER BY nomenclatura ASC
    `, [ejeNum, anio])

    const lineasEnriquecidas = enriquecer(lineasRes.rows)
    const lineasPorEstrategia = {}
    lineasEnriquecidas.forEach(l => {
      const k = l.strategy_id || "sin_estrategia"
      if (!lineasPorEstrategia[k]) lineasPorEstrategia[k] = []
      lineasPorEstrategia[k].push(l)
    })

    const estrategiasIndicadores = estrategiasRes.rows.map(row => ({
      ...row,
      semaforo_info: SEMAFORO_INFO[row.semaforo] || SEMAFORO_INFO.sin_datos,
      lineas: row.strategy_id ? (lineasPorEstrategia[row.strategy_id] || []) : []
    }))

    const totalLineasEje = lineasEnriquecidas.length
    const cumplimientoGlobalEje = totalLineasEje > 0
      ? Math.round((lineasEnriquecidas.reduce((s, l) => s + Number(l.porcentaje_cumplimiento || 0), 0) / totalLineasEje) * 100) / 100
      : 0
    const semaforoEje = totalLineasEje === 0 ? "sin_datos"
      : cumplimientoGlobalEje >= 90 ? "optimo"
      : cumplimientoGlobalEje >= 70 ? "bueno"
      : cumplimientoGlobalEje >= 50 ? "regular" : "bajo"

    res.json({
      anio,
      eje: {
        ...ejeRes.rows[0],
        eje_num: ejeRes.rows[0].id,
        eje_nombre: ejeRes.rows[0].nombre,
        total_lineas: totalLineasEje,
        lineas_optimo: lineasEnriquecidas.filter(l => l.semaforo === "optimo").length,
        lineas_bueno: lineasEnriquecidas.filter(l => l.semaforo === "bueno").length,
        lineas_regular: lineasEnriquecidas.filter(l => l.semaforo === "regular").length,
        lineas_bajo: lineasEnriquecidas.filter(l => l.semaforo === "bajo").length,
        cumplimiento_global: cumplimientoGlobalEje,
        semaforo_global: semaforoEje,
        semaforo_info: SEMAFORO_INFO[semaforoEje] || SEMAFORO_INFO.sin_datos
      },
      estrategias_indicadores: estrategiasIndicadores,
      lineas: lineasEnriquecidas,
      semaforo_info: SEMAFORO_INFO
    })
  } catch (e) {
    console.error("Error detalle eje semáforo:", e)
    res.status(500).json({ error: e.message })
  }
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
