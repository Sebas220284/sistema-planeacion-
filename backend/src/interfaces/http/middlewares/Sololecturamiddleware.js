const pool = require("../../../database/postgres")

const ROLES_SOLO_LECTURA = ["consulta_planeacion"]

const ROLES_CONOCIDOS = [
  "admin", "planeacion", "dependencias", "viewer",
  "inversion_publica", "planeacion_estrategica", ...ROLES_SOLO_LECTURA
]

const METODOS_LECTURA = ["GET", "HEAD", "OPTIONS"]


const RUTAS_PERMITIDAS = ["/notificaciones", "/pdf"]

module.exports = async (req, res, next) => {
  try {
    if (METODOS_LECTURA.includes(req.method)) return next()
    if (RUTAS_PERMITIDAS.some(p => req.path === p || req.path.startsWith(p + "/"))) return next()

    const u = req.user || {}
    let rol = u.rol || u.role || u.rol_nombre || null

    if (!ROLES_CONOCIDOS.includes(rol)) {
      const id = u.id || u.userId || u.user_id
      if (id) {
        const r = await pool.query(
          `SELECT r.name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
          [id]
        )
        rol = r.rows[0]?.name || rol
      }
    }

    if (ROLES_SOLO_LECTURA.includes(rol)) {
      console.warn(`[SOLO-LECTURA] Bloqueado ${req.method} /api${req.path} (rol ${rol}, usuario ${u.id || "?"})`)
      return res.status(403).json({
        error: "Tu usuario es de solo consulta: no puede crear, editar ni eliminar."
      })
    }
    next()
  } catch (e) {
    console.error("[SOLO-LECTURA] Error verificando el rol:", e.message)
    return res.status(503).json({ error: "No se pudo verificar el permiso" })
  }
}