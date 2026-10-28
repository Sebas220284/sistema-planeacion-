const jwt = require("jsonwebtoken")
const pool = require("../database/postgres")

const ROLES_PLANEACION = ["admin", "planeacion"]
const ROLES_INTERNOS   = ["admin", "planeacion", "planeacion_estrategica", "inversion_publica"]
const ROLES_CHAT       = ["admin", "planeacion", "dependencias"]

const modoEnforce = () => process.env.SOCKET_AUTH_MODE === "enforce"

function normalizar(p) {
  return {
    id:            p.id || p.userId || p.user_id || null,
    rol:           p.rol || p.role || null,
    dependency_id: p.dependency_id || p.dependencyId || null,
    _claves:       Object.keys(p)
  }
}


async function autenticarSocket(socket, next) {
  let token = socket.handshake.auth?.token
  if (typeof token === "string" && token.startsWith("Bearer ")) token = token.slice(7)

  if (!token) {
    if (modoEnforce()) return next(new Error("No autenticado"))
    console.warn(`[SOCKET] ${socket.id} conectó SIN token (modo aviso)`)
    return next()
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    socket.user = normalizar(payload)

    if (socket.user.id) {
      const r = await pool.query("SELECT dependency_id FROM users WHERE id = $1", [socket.user.id])
      socket.user.dependency_id = r.rows[0]?.dependency_id || socket.user.dependency_id
    }
    console.log(`[SOCKET] token válido | rol: ${socket.user.rol} | id: ${socket.user.id ? "sí" : "NO"} | dependencia: ${socket.user.dependency_id ? "sí" : "no"} | campos del token: ${socket.user._claves.join(", ")}`)
    return next()
  } catch (e) {
    if (modoEnforce()) return next(new Error("Token inválido"))
    console.warn(`[SOCKET] ${socket.id} token inválido o error (modo aviso): ${e.message}`)
    return next()
  }
}

const esRolPlaneacion = (rol) => ROLES_PLANEACION.includes(rol)
const esInterno       = (u)   => !!u && ROLES_INTERNOS.includes(u.rol)
const puedeVerDependencia = (u, dep) =>
  esInterno(u) || (!!u && !!u.dependency_id && String(u.dependency_id) === String(dep))

function permitir(socket, ok, detalle) {
  if (ok) return true
  console.warn(`[SOCKET] ${modoEnforce() ? "BLOQUEADO" : "AVISO (se habría bloqueado)"}: ${detalle} | socket ${socket.id} | user ${socket.user?.id || "anónimo"}`)
  return !modoEnforce()
}

module.exports = {
  autenticarSocket, esRolPlaneacion, esInterno, puedeVerDependencia,
  permitir, modoEnforce, ROLES_CHAT
}