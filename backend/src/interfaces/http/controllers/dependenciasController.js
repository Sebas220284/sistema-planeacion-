const pool = require("../../../database/postgres")

exports.listar = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, name, description, titular, enlace, created_at
      FROM dependencies ORDER BY name
    `)
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.actualizarContacto = async (req, res) => {
  try {
    const { titular, enlace } = req.body
    const r = await pool.query(`
      UPDATE dependencies
      SET titular=$1, enlace=$2
      WHERE id=$3
      RETURNING id, name, titular, enlace
    `, [titular||null, enlace||null, req.params.id])
    if (!r.rows[0]) return res.status(404).json({ error: "Dependencia no encontrada" })
    res.json(r.rows[0])
  } catch(e) {
    console.error("Error actualizando contacto:", e)
    res.status(500).json({ error: e.message })
  }
}