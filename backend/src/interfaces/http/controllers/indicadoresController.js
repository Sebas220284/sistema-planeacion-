const pool = require("../../../database/postgres")

exports.listar = async (req, res) => {
  try {
    const soloPend = req.query.pendientes === "1"
    const eje = req.query.eje ? String(req.query.eje).trim().split(".")[0] : null
    const conditions = []
    const params = []

    if (soloPend) {
      conditions.push("(requiere_revision = TRUE OR indicador IS NULL)")
    }
    if (eje) {
      params.push(eje)
      conditions.push(`split_part(clave, '.', 1) = $${params.length}`)
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

    const r = await pool.query(`
      SELECT
        v.strategy_id,
        v.estrategia,
        v.clave,
        split_part(v.clave, '.', 1) AS eje_num,
        v.indicador,
        v.requiere_revision,
        v.nota,
        p.supuesto,
        (SELECT COUNT(*)::int FROM planning_templates pt WHERE pt.strategy_id = v.strategy_id) AS num_lineas
      FROM v_estrategia_indicador v
      LEFT JOIN (
        SELECT DISTINCT ON (clave) clave, supuesto
        FROM estrategia_supuestos
        ORDER BY clave, orden ASC
      ) p ON p.clave = v.clave
      ${whereClause ? whereClause.replace(/\bclave\b/g, 'v.clave').replace(/\bindicador\b/g, 'v.indicador').replace(/\brequiere_revision\b/g, 'v.requiere_revision') : ""}
      ORDER BY
        string_to_array(v.clave, '.')::int[],
        (SELECT COUNT(*) FROM planning_templates pt WHERE pt.strategy_id = v.strategy_id) DESC
    `, params)
    res.json(r.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Error al listar indicadores" })
  }
}

exports.ejes = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT DISTINCT
        split_part(ei.clave, '.', 1) AS eje_num,
        COALESCE(pe.nombre, 'Eje ' || split_part(ei.clave, '.', 1)) AS nombre,
        COUNT(ei.id)::int AS total_indicadores
      FROM estrategia_indicadores ei
      LEFT JOIN pmd_ejes pe ON pe.id::text = split_part(ei.clave, '.', 1)
      WHERE ei.clave IS NOT NULL
      GROUP BY split_part(ei.clave, '.', 1), pe.nombre
      ORDER BY split_part(ei.clave, '.', 1)::int
    `)
    res.json(r.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Error al listar ejes de indicadores" })
  }
}

exports.porEje = async (req, res) => {
  try {
    const ejeNum = String(req.params.eje || "").trim().split(".")[0]
    const r = await pool.query(`
      SELECT id, clave, split_part(clave, '.', 1) AS eje_num, indicador, requiere_revision, nota
      FROM estrategia_indicadores
      WHERE split_part(clave, '.', 1) = $1
        AND indicador IS NOT NULL
      ORDER BY string_to_array(clave, '.')::int[]
    `, [ejeNum])
    res.json(r.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Error al listar indicadores por eje" })
  }
}

exports.porEstrategia = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT v.strategy_id, v.estrategia, v.clave, v.indicador, v.requiere_revision, p.supuesto
      FROM v_estrategia_indicador v
      LEFT JOIN (
        SELECT DISTINCT ON (clave) clave, supuesto
        FROM estrategia_supuestos
        ORDER BY clave, orden ASC
      ) p ON p.clave = v.clave
      WHERE v.strategy_id = $1
    `, [req.params.strategy_id])
    if (!r.rows[0]) return res.status(404).json({ error: "Estrategia no encontrada" })
    res.json(r.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Error al obtener indicador" })
  }
}

exports.actualizar = async (req, res) => {
  try {
    const indicador = (req.body.indicador || "").trim()
    if (!indicador) return res.status(400).json({ error: "El indicador no puede ir vacío" })

    const r = await pool.query(`
      UPDATE estrategia_indicadores
      SET indicador = $1, requiere_revision = FALSE, nota = NULL, updated_at = NOW()
      WHERE clave = $2
      RETURNING clave, indicador, requiere_revision
    `, [indicador, req.params.clave])

    if (!r.rows[0]) return res.status(404).json({ error: "Clave no encontrada" })
    res.json(r.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Error al actualizar indicador" })
  }
}
