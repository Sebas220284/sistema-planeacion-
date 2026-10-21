const pool = require("../../../database/postgres")

// ─────────────────────────────────────────────────────────────
// Metas del POG (POT) por año.
// pot_registros guarda la meta trianual repartida en columnas fijas
// por ejercicio, así que el año se traduce aquí a su columna.
// ─────────────────────────────────────────────────────────────
const COLUMNAS_EJERCICIO = {
  2025: "ejercicio_2025",
  2026: "ejercicio_2026",
  2027: "ejercicio_2027",
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_LINEAS_POR_PETICION = 1000

// POST /api/pot/metas  body: { anio, ids: [planning_template_id] }
// Responde { anio, metas: { [planning_template_id]: { meta_pog, meta_programada, registros } } }.
// Una línea puede tener varios registros en el POT: se suman.
// Las líneas sin registro simplemente no aparecen en el objeto.
exports.metasPorLineas = async (req, res) => {
  try {
    const anio = parseInt(req.body && req.body.anio)
    const columna = COLUMNAS_EJERCICIO[anio]
    if (!columna) {
      return res.status(400).json({
        error: `El año ${req.body && req.body.anio} no tiene programación en el POT`,
        anios_disponibles: Object.keys(COLUMNAS_EJERCICIO).map(Number)
      })
    }

    const ids = req.body && req.body.ids
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_LINEAS_POR_PETICION ||
        !ids.every(id => typeof id === "string" && UUID_RE.test(id))) {
      return res.status(400).json({ error: `ids debe ser un arreglo de hasta ${MAX_LINEAS_POR_PETICION} UUID` })
    }

    const unicos = [...new Set(ids.map(id => id.toLowerCase()))]

    const r = await pool.query(`
      SELECT planning_template_id, numero_registro, meta_programada,
             ${columna} AS meta_pog
      FROM pot_registros
      WHERE planning_template_id = ANY($1::uuid[])
      ORDER BY numero_registro
    `, [unicos])

    const metas = {}
    r.rows.forEach(row => {
      const k = row.planning_template_id
      if (!metas[k]) metas[k] = { meta_pog: 0, meta_programada: 0, registros: [] }
      metas[k].meta_pog        += Number(row.meta_pog || 0)
      metas[k].meta_programada += Number(row.meta_programada || 0)
      metas[k].registros.push(row.numero_registro)
    })

    res.json({ anio, columna, metas })
  } catch(e) {
    console.error("Error metas POG:", e)
    res.status(500).json({ error: e.message })
  }
}


exports.listar = async (req, res) => {
  try {
    const pagina  = parseInt(req.query.pagina)  || 1
    const limite  = parseInt(req.query.limite)  || 50
    const offset  = (pagina - 1) * limite
    const anio    = req.query.anio    || null   // '2025' | '2026' | '2027'
    const busqueda = req.query.q      || null

    let where  = "WHERE 1=1"
    const params = []

    if (busqueda) {
      params.push(`%${busqueda}%`)
      where += ` AND (p.descripcion ILIKE $${params.length}
                   OR p.numero_registro::text ILIKE $${params.length})`
    }

    const total = await pool.query(`SELECT COUNT(*) FROM pot_registros p ${where}`, params)

    const r = await pool.query(`
      SELECT
        p.*,
        d.name AS dependencia_nombre,
        pt.lineas_accion,
        s.name AS strategy_nombre,
        -- Distribución automática por año
        ROUND((p.ejercicio_2025 / NULLIF(p.meta_programada,0) * 100)::numeric,2) AS pct_calc_2025,
        ROUND((p.ejercicio_2026 / NULLIF(p.meta_programada,0) * 100)::numeric,2) AS pct_calc_2026,
        ROUND((p.ejercicio_2027 / NULLIF(p.meta_programada,0) * 100)::numeric,2) AS pct_calc_2027,
        -- Suma verificación
        ROUND(((p.ejercicio_2025 + p.ejercicio_2026 + p.ejercicio_2027)
               / NULLIF(p.meta_programada,0) * 100)::numeric, 2) AS suma_distribucion
      FROM pot_registros p
      LEFT JOIN dependencies d      ON d.id  = p.dependency_id
      LEFT JOIN planning_templates pt ON pt.id = p.planning_template_id
      LEFT JOIN strategies s         ON s.id  = p.strategy_id
      ${where}
      ORDER BY p.numero_registro ASC
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `, [...params, limite, offset])

    res.json({
      datos:      r.rows,
      total:      parseInt(total.rows[0].count),
      pagina,
      limite,
      total_paginas: Math.ceil(parseInt(total.rows[0].count) / limite)
    })
  } catch(e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}

exports.resumen = async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM v_pot_resumen`)

    const dist = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE porcentaje_2025 = 0)::int      AS pct25_cero,
        COUNT(*) FILTER (WHERE porcentaje_2025 BETWEEN 1 AND 33)::int  AS pct25_bajo,
        COUNT(*) FILTER (WHERE porcentaje_2025 BETWEEN 34 AND 66)::int AS pct25_medio,
        COUNT(*) FILTER (WHERE porcentaje_2025 BETWEEN 67 AND 99)::int AS pct25_alto,
        COUNT(*) FILTER (WHERE porcentaje_2025 = 100)::int    AS pct25_completo,
        COUNT(*) FILTER (WHERE porcentaje_2026 = 0)::int      AS pct26_cero,
        COUNT(*) FILTER (WHERE porcentaje_2026 = 100)::int    AS pct26_completo,
        COUNT(*) FILTER (WHERE porcentaje_2027 = 0)::int      AS pct27_cero,
        COUNT(*) FILTER (WHERE porcentaje_2027 = 100)::int    AS pct27_completo
      FROM pot_registros
    `)

    const top10 = await pool.query(`
      SELECT numero_registro, meta_programada, descripcion,
        ejercicio_2025, ejercicio_2026, ejercicio_2027,
        porcentaje_2025, porcentaje_2026, porcentaje_2027
      FROM pot_registros
      ORDER BY meta_programada DESC
      LIMIT 10
    `)

    res.json({
      global:        r.rows[0],
      distribucion:  dist.rows[0],
      top10_meta:    top10.rows
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.obtener = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT p.*,
        d.name AS dependencia_nombre,
        pt.lineas_accion, pt.pmd_eje, pt.pmd_estrategia,
        s.name AS strategy_nombre
      FROM pot_registros p
      LEFT JOIN dependencies d ON d.id = p.dependency_id
      LEFT JOIN planning_templates pt ON pt.id = p.planning_template_id
      LEFT JOIN strategies s ON s.id = p.strategy_id
      WHERE p.id = $1
    `, [req.params.id])

    if (!r.rows[0]) return res.status(404).json({ error: "Registro no encontrado" })
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.actualizar = async (req, res) => {
  try {
    const { descripcion, planning_template_id, dependency_id, strategy_id } = req.body
    const r = await pool.query(`
      UPDATE pot_registros
      SET descripcion=$1, planning_template_id=$2,
          dependency_id=$3, strategy_id=$4, updated_at=NOW()
      WHERE id=$5 RETURNING *
    `, [
      descripcion||null,
      planning_template_id||null,
      dependency_id||null,
      strategy_id||null,
      req.params.id
    ])
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.porDependencia = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT p.*,
        ROUND((p.ejercicio_2025/NULLIF(p.meta_programada,0)*100)::numeric,2) AS pct_calc_2025,
        ROUND((p.ejercicio_2026/NULLIF(p.meta_programada,0)*100)::numeric,2) AS pct_calc_2026,
        ROUND((p.ejercicio_2027/NULLIF(p.meta_programada,0)*100)::numeric,2) AS pct_calc_2027
      FROM pot_registros p
      WHERE p.dependency_id = $1
      ORDER BY p.numero_registro
    `, [req.params.dep_id])

    const totales = await pool.query(`
      SELECT
        SUM(meta_programada)  AS total_meta,
        SUM(ejercicio_2025)   AS total_2025,
        SUM(ejercicio_2026)   AS total_2026,
        SUM(ejercicio_2027)   AS total_2027
      FROM pot_registros WHERE dependency_id=$1
    `, [req.params.dep_id])

    res.json({ registros: r.rows, totales: totales.rows[0] })
  } catch(e) { res.status(500).json({ error: e.message }) }
}