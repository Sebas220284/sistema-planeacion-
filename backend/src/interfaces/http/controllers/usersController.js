const pool = require("../../../database/postgres")
const bcrypt = require("bcrypt")

exports.listar = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT u.id, u.name, u.email, u.role_id, u.dependency_id, u.acceso_restringido, 
        u.dependency_position, u.dependency_role, u.created_at, u.permisos_menu,
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
      SELECT u.id, u.name, u.email, u.role_id, u.dependency_id, u.permisos_menu,
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
    const { name, email, password, role_id, dependency_id, dependency_position, dependency_role, permisos_menu } = req.body

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
    
    // Default fallback to ensure backwards compatibility if not provided
    const menuPerms = permisos_menu ? JSON.stringify(permisos_menu) : '["cip", "arboles", "estrategias", "notificaciones_dep"]';

    const r = await pool.query(`
      INSERT INTO users (name, email, password_hash, role_id, dependency_id, dependency_position, dependency_role, permisos_menu)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id, name, email, role_id, dependency_id, dependency_position, dependency_role, permisos_menu, created_at
    `, [
      name, email, passwordHash, role_id,
      dependency_id || null, dependency_position || null, dependency_role || null, menuPerms
    ])

    res.json(r.rows[0])
  } catch(e) {
    console.error("Error creando usuario:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.actualizar = async (req, res) => {
  try {
    const { name, email, role_id, dependency_id, dependency_position, dependency_role, permisos_menu } = req.body

    if (!name || !email || !role_id) {
      return res.status(400).json({ error: "Nombre, correo y rol son obligatorios" })
    }

    const existe = await pool.query(`SELECT id FROM users WHERE email=$1 AND id != $2`, [email, req.params.id])
    if (existe.rows.length > 0) {
      return res.status(400).json({ error: "Ese correo ya está en uso por otro usuario" })
    }
    
    const menuPerms = permisos_menu ? JSON.stringify(permisos_menu) : '["cip", "arboles", "estrategias", "notificaciones_dep"]';

    const r = await pool.query(`
      UPDATE users SET name=$1, email=$2, role_id=$3,
        dependency_id=$4, dependency_position=$5, dependency_role=$6, permisos_menu=$7
      WHERE id=$8
      RETURNING id, name, email, role_id, dependency_id, dependency_position, dependency_role, permisos_menu
    `, [
      name, email, role_id,
      dependency_id || null, dependency_position || null, dependency_role || null, menuPerms,
      req.params.id
    ])

    if (!r.rows[0]) return res.status(404).json({ error: "Usuario no encontrado" })
    res.json(r.rows[0])
  } catch(e) {
    console.error("Error actualizando usuario:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.actualizarPermisos = async (req, res) => {
  try {
    const { permisos_menu } = req.body;
    const menuPerms = JSON.stringify(permisos_menu || []);

    const r = await pool.query(`
      UPDATE users SET permisos_menu=$1 WHERE id=$2
      RETURNING id, permisos_menu
    `, [menuPerms, req.params.id]);

    if (!r.rows[0]) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ ok: true, usuario: r.rows[0], mensaje: "Permisos actualizados correctamente" });
  } catch (e) {
    console.error("Error actualizando permisos:", e);
    res.status(500).json({ error: e.message });
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

exports.syncDependencias = async (req, res) => {
  try {
    const { nuevosPermisos } = req.body;
    if (!Array.isArray(nuevosPermisos)) return res.status(400).json({ error: "nuevosPermisos debe ser un arreglo" });

    const result = await pool.query(`SELECT id, permisos_menu FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'dependencias' LIMIT 1)`);
    let count = 0;

    for (const row of result.rows) {
      let perms = [];
      if (typeof row.permisos_menu === 'string') {
        try { perms = JSON.parse(row.permisos_menu); } catch(e) {}
      } else if (Array.isArray(row.permisos_menu)) {
        perms = row.permisos_menu;
      }

      let modified = false;
      for (const p of nuevosPermisos) {
        if (!perms.includes(p)) {
          perms.push(p);
          modified = true;
        }
      }

      if (modified) {
        await pool.query(`UPDATE users SET permisos_menu = $1 WHERE id = $2`, [JSON.stringify(perms), row.id]);
        count++;
      }
    }

    res.json({ message: `Permisos sincronizados correctamente en ${count} dependencias.` });
  } catch (e) {
    console.error("Error sincronizando permisos:", e);
    res.status(500).json({ error: e.message });
  }
};

exports.actualizarPermisosMasivos = async (req, res) => {
  try {
    const { permisos } = req.body;
    if (!Array.isArray(permisos)) return res.status(400).json({ error: "permisos debe ser un arreglo" });

    const result = await pool.query(
      `UPDATE users SET permisos_menu = $1 WHERE role_id = (SELECT id FROM roles WHERE name = 'dependencias' LIMIT 1) RETURNING id`, 
      [JSON.stringify(permisos)]
    );
    
    res.json({ message: `Permisos masivos actualizados correctamente en ${result.rowCount} dependencias.` });
  } catch (e) {
    console.error("Error actualizando permisos masivos:", e);
    res.status(500).json({ error: e.message });
  }
};