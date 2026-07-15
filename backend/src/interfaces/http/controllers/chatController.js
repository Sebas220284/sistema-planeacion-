const pool = require("../../../database/postgres")

exports.obtenerOCrearConversacion = async (req, res) => {
  try {
    const { dependency_id } = req.params

    let conv = await pool.query(
      `SELECT c.*, d.name as dependencia_nombre
       FROM chat_conversaciones c
       JOIN dependencies d ON d.id = c.dependency_id
       WHERE c.dependency_id = $1`,
      [dependency_id]
    )

    if (conv.rows.length === 0) {
      conv = await pool.query(
        `INSERT INTO chat_conversaciones (dependency_id)
         VALUES ($1)
         RETURNING *`,
        [dependency_id]
      )
      const dep = await pool.query(`SELECT name FROM dependencies WHERE id=$1`, [dependency_id])
      conv.rows[0].dependencia_nombre = dep.rows[0]?.name || ""
    }

    res.json(conv.rows[0])
  } catch(e) {
    console.error("Error conv:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.listarConversaciones = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT c.*,
        d.name AS dependencia_nombre,
        d.titular,
        (SELECT COUNT(*) FROM chat_mensajes m
         WHERE m.conversacion_id = c.id) AS total_mensajes
      FROM chat_conversaciones c
      JOIN dependencies d ON d.id = c.dependency_id
      ORDER BY
        c.mensajes_no_leidos_planeacion DESC,
        c.ultimo_mensaje_at DESC NULLS LAST
    `)
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.getMensajes = async (req, res) => {
  try {
    const { conversacion_id } = req.params
    const limit  = parseInt(req.query.limit)  || 50
    const offset = parseInt(req.query.offset) || 0

    const r = await pool.query(`
      SELECT * FROM chat_mensajes
      WHERE conversacion_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3
    `, [conversacion_id, limit, offset])

    const total = await pool.query(
      `SELECT COUNT(*) FROM chat_mensajes WHERE conversacion_id=$1`,
      [conversacion_id]
    )

    res.json({ mensajes: r.rows, total: parseInt(total.rows[0].count) })
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.marcarLeido = async (req, res) => {
  try {
    const { conversacion_id, lado } = req.body

    if (lado === "planeacion") {
      await pool.query(
        `UPDATE chat_mensajes SET leido_planeacion=TRUE
         WHERE conversacion_id=$1 AND leido_planeacion=FALSE`,
        [conversacion_id]
      )
      await pool.query(
        `UPDATE chat_conversaciones SET mensajes_no_leidos_planeacion=0
         WHERE id=$1`,
        [conversacion_id]
      )
    } else {
      await pool.query(
        `UPDATE chat_mensajes SET leido_dependencia=TRUE
         WHERE conversacion_id=$1 AND leido_dependencia=FALSE`,
        [conversacion_id]
      )
      await pool.query(
        `UPDATE chat_conversaciones SET mensajes_no_leidos_dependencia=0
         WHERE id=$1`,
        [conversacion_id]
      )
    }

    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.getStats = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*)::int AS total_conversaciones,
        SUM(mensajes_no_leidos_planeacion)::int AS total_no_leidos,
        (SELECT COUNT(*)::int FROM chat_mensajes
         WHERE created_at > NOW() - INTERVAL '24 hours') AS mensajes_hoy
      FROM chat_conversaciones
    `)
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
}