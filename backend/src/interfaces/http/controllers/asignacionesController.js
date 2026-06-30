const pool = require("../../../database/postgres")

exports.asignar = async (req, res) => {
  try {
    const { user_id, dependency_ids, asignado_por } = req.body
    if (!user_id || !Array.isArray(dependency_ids)) {
      return res.status(400).json({ error: "user_id y dependency_ids son obligatorios" })
    }

    await pool.query(`DELETE FROM user_dependencias_asignadas WHERE user_id=$1`, [user_id])

    if (dependency_ids.length > 0) {
      const values = dependency_ids.map((_, i) => `($1, $${i+2}, $${dependency_ids.length+2})`).join(",")
      await pool.query(
        `INSERT INTO user_dependencias_asignadas (user_id, dependency_id, asignado_por) VALUES ${values}`,
        [user_id, ...dependency_ids, asignado_por || null]
      )
    }

    await pool.query(
      `UPDATE users SET acceso_restringido=$1 WHERE id=$2`,
      [dependency_ids.length > 0, user_id]
    )

    res.json({ ok: true, total: dependency_ids.length })
  } catch(e) {
    console.error("Error asignando dependencias:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.getAsignadas = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT d.id, d.name
      FROM user_dependencias_asignadas uda
      JOIN dependencies d ON d.id = uda.dependency_id
      WHERE uda.user_id = $1
      ORDER BY d.name
    `, [req.params.user_id])
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.quitarRestriccion = async (req, res) => {
  try {
    await pool.query(`DELETE FROM user_dependencias_asignadas WHERE user_id=$1`, [req.params.user_id])
    await pool.query(`UPDATE users SET acceso_restringido=FALSE WHERE id=$1`, [req.params.user_id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
}