const pool = require("../../../database/postgres")

exports.getTodos = async (req, res) => {
  try {
    const odsRes = await pool.query(`
      SELECT * FROM ods_objetivos ORDER BY numero
    `)

    const resultado = []
    for (const ods of odsRes.rows) {
      const metasRes = await pool.query(`
        SELECT m.*, 
          COALESCE(
            json_agg(
              json_build_object(
                'id', i.id,
                'codigo_indicador', i.codigo_indicador,
                'descripcion', i.descripcion,
                'nivel_seguimiento', i.nivel_seguimiento
              )
            ) FILTER (WHERE i.id IS NOT NULL),
            '[]'
          ) AS indicadores
        FROM ods_metas m
        LEFT JOIN ods_indicadores i ON i.meta_id = m.id
        WHERE m.ods_id = $1
        GROUP BY m.id
        ORDER BY m.codigo_meta
      `, [ods.id])

      resultado.push({
        ...ods,
        total_metas: metasRes.rows.length,
        metas: metasRes.rows
      })
    }

    res.json({
      total: resultado.length,
      ods: resultado
    })
  } catch(e) {
    console.error("Error ODS:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.getUno = async (req, res) => {
  try {
    const num = parseInt(req.params.numero)
    if (isNaN(num) || num < 1 || num > 17) {
      return res.status(400).json({ error: "Número de ODS inválido (1-17)" })
    }

    const odsRes = await pool.query(`
      SELECT * FROM ods_objetivos WHERE numero = $1
    `, [num])

    if (!odsRes.rows[0]) {
      return res.status(404).json({ error: "ODS no encontrado" })
    }

    const metasRes = await pool.query(`
      SELECT m.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', i.id,
              'codigo_indicador', i.codigo_indicador,
              'descripcion', i.descripcion,
              'nivel_seguimiento', i.nivel_seguimiento
            )
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'
        ) AS indicadores
      FROM ods_metas m
      LEFT JOIN ods_indicadores i ON i.meta_id = m.id
      WHERE m.ods_id = $1
      GROUP BY m.id
      ORDER BY m.codigo_meta
    `, [odsRes.rows[0].id])

    res.json({
      ...odsRes.rows[0],
      total_metas:      metasRes.rows.length,
      total_indicadores: metasRes.rows.reduce((s,m) => s + (m.indicadores||[]).length, 0),
      metas: metasRes.rows
    })
  } catch(e) {
    console.error("Error ODS uno:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.getLista = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, numero, codigo, nombre, color_hex, icono_emoji
      FROM ods_objetivos
      ORDER BY numero
    `)
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.buscar = async (req, res) => {
  try {
    const q = req.query.q || ""
    if (!q.trim()) return res.json([])

    const r = await pool.query(`
      SELECT DISTINCT
        o.id, o.numero, o.codigo, o.nombre, o.color_hex, o.icono_emoji,
        m.codigo_meta, m.descripcion as meta_descripcion
      FROM ods_objetivos o
      LEFT JOIN ods_metas m ON m.ods_id = o.id
      WHERE
        o.nombre ILIKE $1 OR
        o.descripcion ILIKE $1 OR
        m.descripcion ILIKE $1
      ORDER BY o.numero
      LIMIT 50
    `, [`%${q}%`])

    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.getMetas = async (req, res) => {
  try {
    const num = parseInt(req.params.numero)
    const odsRow = await pool.query(`SELECT id FROM ods_objetivos WHERE numero=$1`, [num])
    if (!odsRow.rows[0]) return res.status(404).json({ error: "ODS no encontrado" })

    const r = await pool.query(`
      SELECT * FROM ods_metas WHERE ods_id=$1 ORDER BY codigo_meta
    `, [odsRow.rows[0].id])

    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.getStats = async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM ods_objetivos)   AS total_ods,
        (SELECT COUNT(*) FROM ods_metas)        AS total_metas,
        (SELECT COUNT(*) FROM ods_indicadores)  AS total_indicadores,
        (SELECT COUNT(*) FROM ods_metas WHERE tipo='meta') AS total_metas_sustantivas,
        (SELECT COUNT(*) FROM ods_metas WHERE tipo='medio_implementacion') AS total_medios
    `)
    res.json(stats.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
}
exports.getPnd = async (req, res) => {
  try {
    const r = await pool.query(
      SELECT p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', o.id,
              'codigo', o.codigo,
              'nombre', o.nombre,
              'color_hex', o.color_hex,
              'icono_emoji', o.icono_emoji
            )
          ) FILTER (WHERE o.id IS NOT NULL),
          '[]'
        ) AS ods_alineados
      FROM pnd_ejes p
      LEFT JOIN pnd_ejes_ods rel ON p.id = rel.pnd_eje_id
      LEFT JOIN ods_objetivos o ON rel.ods_id = o.id
      GROUP BY p.id
      ORDER BY p.id
    )
    res.json(r.rows)
  } catch(e) {
    console.error("Error getPnd:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.getPed = async (req, res) => {
  try {
    const r = await pool.query(
      SELECT p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', o.id,
              'codigo', o.codigo,
              'nombre', o.nombre,
              'color_hex', o.color_hex,
              'icono_emoji', o.icono_emoji
            )
          ) FILTER (WHERE o.id IS NOT NULL),
          '[]'
        ) AS ods_alineados
      FROM ped_ejes p
      LEFT JOIN ped_ejes_ods rel ON p.id = rel.ped_eje_id
      LEFT JOIN ods_objetivos o ON rel.ods_id = o.id
      GROUP BY p.id
      ORDER BY p.id
    )
    res.json(r.rows)
  } catch(e) {
    console.error("Error getPed:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.getPmd = async (req, res) => {
  try {
    const r = await pool.query(
      SELECT p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', o.id,
              'codigo', o.codigo,
              'nombre', o.nombre,
              'color_hex', o.color_hex,
              'icono_emoji', o.icono_emoji
            )
          ) FILTER (WHERE o.id IS NOT NULL),
          '[]'
        ) AS ods_alineados
      FROM pmd_ejes p
      LEFT JOIN pmd_ejes_ods rel ON p.id = rel.pmd_eje_id
      LEFT JOIN ods_objetivos o ON rel.ods_id = o.id
      GROUP BY p.id
      ORDER BY p.id
    )
    res.json(r.rows)
  } catch(e) {
    console.error("Error getPmd:", e)
    res.status(500).json({ error: e.message })
  }
}
