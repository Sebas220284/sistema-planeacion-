const pool = require("../../../database/postgres")

exports.getTodos = async (req, res) => {
  try {
    const grupos = await pool.query(`
      SELECT id, nombre, icono, color_hex, orden
      FROM cip_grupos_poblacionales
      ORDER BY orden
    `)

    const resultado = []

    for (const g of grupos.rows) {
      const caracts = await pool.query(`
        SELECT c.id, c.tipo, c.texto, c.es_lista,
          COALESCE(
            json_agg(
              json_build_object('id', s.id, 'texto', s.texto, 'orden', s.orden)
              ORDER BY s.orden
            ) FILTER (WHERE s.id IS NOT NULL),
            '[]'
          ) AS sublista
        FROM cip_grupos_caracteristicas c
        LEFT JOIN cip_grupos_sublista s ON s.caracteristica_id = c.id
        WHERE c.grupo_id = $1
        GROUP BY c.id, c.tipo, c.texto, c.es_lista, c.orden
        ORDER BY c.tipo, c.orden
      `, [g.id])

      const caracteristicas = caracts.rows.filter(r => r.tipo === 'caracteristica')
      const referencias     = caracts.rows.filter(r => r.tipo === 'referencia')

      resultado.push({
        ...g,
        caracteristicas,
        referencias
      })
    }

    res.json(resultado)
  } catch(e) {
    console.error("Error grupos poblacionales:", e)
    res.status(500).json({ error: e.message })
  }
}
const pool = require("../../../database/postgres")

// ── Todos los grupos con características y referencias
exports.getTodos = async (req, res) => {
  try {
    const grupos = await pool.query(`
      SELECT id, nombre, icono, color_hex, orden
      FROM cip_grupos_poblacionales
      ORDER BY orden
    `)

    const resultado = []

    for (const g of grupos.rows) {
      const caracts = await pool.query(`
        SELECT c.id, c.tipo, c.texto, c.es_lista,
          COALESCE(
            json_agg(
              json_build_object('id', s.id, 'texto', s.texto, 'orden', s.orden)
              ORDER BY s.orden
            ) FILTER (WHERE s.id IS NOT NULL),
            '[]'
          ) AS sublista
        FROM cip_grupos_caracteristicas c
        LEFT JOIN cip_grupos_sublista s ON s.caracteristica_id = c.id
        WHERE c.grupo_id = $1
        GROUP BY c.id, c.tipo, c.texto, c.es_lista, c.orden
        ORDER BY c.tipo, c.orden
      `, [g.id])

      const caracteristicas = caracts.rows.filter(r => r.tipo === 'caracteristica')
      const referencias     = caracts.rows.filter(r => r.tipo === 'referencia')

      resultado.push({
        ...g,
        caracteristicas,
        referencias
      })
    }

    res.json(resultado)
  } catch(e) {
    console.error("Error grupos poblacionales:", e)
    res.status(500).json({ error: e.message })
  }
}

// ── Un grupo específico
exports.getUno = async (req, res) => {
  try {
    const g = await pool.query(`
      SELECT * FROM cip_grupos_poblacionales WHERE id=$1
    `, [req.params.id])

    if (!g.rows[0]) return res.status(404).json({ error: "Grupo no encontrado" })

    const caracts = await pool.query(`
      SELECT c.id, c.tipo, c.texto, c.es_lista,
        COALESCE(
          json_agg(
            json_build_object('id', s.id, 'texto', s.texto)
            ORDER BY s.orden
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS sublista
      FROM cip_grupos_caracteristicas c
      LEFT JOIN cip_grupos_sublista s ON s.caracteristica_id = c.id
      WHERE c.grupo_id = $1
      GROUP BY c.id ORDER BY c.tipo, c.orden
    `, [req.params.id])

    res.json({
      ...g.rows[0],
      caracteristicas: caracts.rows.filter(r=>r.tipo==='caracteristica'),
      referencias:     caracts.rows.filter(r=>r.tipo==='referencia')
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
}
exports.getUno = async (req, res) => {
  try {
    const g = await pool.query(`
      SELECT * FROM cip_grupos_poblacionales WHERE id=$1
    `, [req.params.id])

    if (!g.rows[0]) return res.status(404).json({ error: "Grupo no encontrado" })

    const caracts = await pool.query(`
      SELECT c.id, c.tipo, c.texto, c.es_lista,
        COALESCE(
          json_agg(
            json_build_object('id', s.id, 'texto', s.texto)
            ORDER BY s.orden
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) AS sublista
      FROM cip_grupos_caracteristicas c
      LEFT JOIN cip_grupos_sublista s ON s.caracteristica_id = c.id
      WHERE c.grupo_id = $1
      GROUP BY c.id ORDER BY c.tipo, c.orden
    `, [req.params.id])

    res.json({
      ...g.rows[0],
      caracteristicas: caracts.rows.filter(r=>r.tipo==='caracteristica'),
      referencias:     caracts.rows.filter(r=>r.tipo==='referencia')
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
}