const pool = require("../../../database/postgres")
const bcrypt = require("bcrypt")

exports.listar = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT u.id, u.name, u.email, u.role_id, u.dependency_id,
        u.dependency_position, u.dependency_role, u.created_at,
        r.name as rol_nombre, r.description as rol_descripcion, r.level as rol_nivel,
        d.name as dependencia_nombre
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN dependencies d ON d.id = u.dependency_id
      ORDER BY u.name
    `)
    res.json(r.rows)
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }) }
}

exports.obtener = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT u.id, u.name, u.email, u.role_id, u.dependency_id,
        u.dependency_position, u.dependency_role,
        r.name as rol_nombre, d.name as dependencia_nombre
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN dependencies d ON d.id = u.dependency_id
      WHERE u.id=$1
    `, [req.params.id])
    if (!r.rows[0]) return res.status(404).json({ error: "Usuario no encontrado" })
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.getRoles = async (req, res) => {
  try {
    const r = await pool.query(`SELECT id, name, description, level FROM roles ORDER BY level DESC`)
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.crear = async (req, res) => {
  try {
    const { name, email, password, role_id, dependency_id, dependency_position, dependency_role } = req.body

    if (!name || !email || !password || !role_id) {
      return res.status(400).json({ error: "Nombre, correo, contraseña y rol son obligatorios" })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" })
    }

    const existe = await pool.query(`SELECT id FROM users WHERE email=$1`, [email])
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: "Ya existe un usuario con ese correo" })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const r = await pool.query(`
      INSERT INTO users (name, email, password_hash, role_id, dependency_id, dependency_position, dependency_role)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id, name, email, role_id, dependency_id, dependency_position, dependency_role, created_at
    `, [
      name, email, passwordHash, role_id,
      dependency_id || null, dependency_position || null, dependency_role || null
    ])

    res.json(r.rows[0])
  } catch(e) {
    console.error("Error creando usuario:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.actualizar = async (req, res) => {
  try {
    const { name, email, role_id, dependency_id, dependency_position, dependency_role } = req.body

    if (!name || !email || !role_id) {
      return res.status(400).json({ error: "Nombre, correo y rol son obligatorios" })
    }

    const existe = await pool.query(`SELECT id FROM users WHERE email=$1 AND id != $2`, [email, req.params.id])
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: "Ese correo ya está en uso por otro usuario" })
    }

    const r = await pool.query(`
      UPDATE users SET name=$1, email=$2, role_id=$3,
        dependency_id=$4, dependency_position=$5, dependency_role=$6
      WHERE id=$7
      RETURNING id, name, email, role_id, dependency_id, dependency_position, dependency_role
    `, [
      name, email, role_id,
      dependency_id || null, dependency_position || null, dependency_role || null,
      req.params.id
    ])

    if (!r.rows[0]) return res.status(404).json({ error: "Usuario no encontrado" })
    res.json(r.rows[0])
  } catch(e) {
    console.error("Error actualizando usuario:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.cambiarPassword = async (req, res) => {
  try {
    const { password } = req.body

    if (!password || password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const r = await pool.query(`
      UPDATE users SET password_hash=$1 WHERE id=$2
      RETURNING id, name, email
    `, [passwordHash, req.params.id])

    if (!r.rows[0]) return res.status(404).json({ error: "Usuario no encontrado" })
    res.json({ ok: true, usuario: r.rows[0], mensaje: "Contraseña actualizada correctamente" })
  } catch(e) {
    console.error("Error cambiando contraseña:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.eliminar = async (req, res) => {
  try {
    if (req.query.solicitante_id === req.params.id) {
      return res.status(400).json({ error: "No puedes eliminar tu propio usuario" })
    }

    await pool.query(`DELETE FROM users WHERE id=$1`, [req.params.id])
    res.json({ ok: true })
  } catch(e) {
    console.error("Error eliminando usuario:", e)
    res.status(500).json({ error: e.message })
  }
}