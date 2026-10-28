const pool = require("../database/postgres")
const {
  autenticarSocket, esRolPlaneacion, esInterno, puedeVerDependencia,
  permitir, modoEnforce, ROLES_CHAT
} = require("./socketAuth")

function registrarSockets(io) {
  io.use(autenticarSocket)

  io.on("connection", (socket) => {
    console.log("Usuario conectado:", socket.id, socket.user ? `(${socket.user.rol})` : "(sin autenticar)")

    socket.on("join_room", (dependency_id) => {
      if (!permitir(socket, puedeVerDependencia(socket.user, dependency_id), `join_room a ${dependency_id}`)) return
      socket.join(dependency_id)
      console.log(`Socket ${socket.id} se unió al room ${dependency_id}`)
    })

    socket.on("join_planeacion", () => {
      if (!permitir(socket, esInterno(socket.user), "join_planeacion")) return
      socket.join("planeacion")
      console.log(`Planeación conectada: ${socket.id}`)
    })

    socket.on("chat_join", ({ dependency_id, user_id, rol } = {}) => {
      const u = socket.user
      if (dependency_id && permitir(socket, puedeVerDependencia(u, dependency_id), `chat_join a dependencia ${dependency_id}`)) {
        socket.join(`chat_dep_${dependency_id}`)
      }
      const rolReal = u?.rol || rol
      if (permitir(socket, esRolPlaneacion(rolReal), `chat_join a sala chat_planeacion con rol ${rolReal}`)) {
        socket.join("chat_planeacion")
      }
      console.log(`Chat: user ${u?.id || user_id} (${rolReal}) unido a dependencia ${dependency_id}`)
    })

    socket.on("chat_mensaje", async (data = {}) => {
      const { conversacion_id, contenido, tipo = "texto" } = data
      const u = socket.user

      if (!contenido?.trim() && tipo === "texto") return

      const remitente_rol = u?.rol || data.remitente_rol
      const remitente_id  = u?.id  || data.remitente_id || null

      if (!permitir(socket, ROLES_CHAT.includes(remitente_rol), `el rol ${remitente_rol} no puede usar el chat`)) {
        return socket.emit("chat_error", { mensaje: "No tienes permiso para usar el chat" })
      }

      try {
        let remitente_nombre = data.remitente_nombre
        let dependency_id = data.dependency_id
        if (remitente_id) {
          const ur = await pool.query("SELECT name, dependency_id FROM users WHERE id = $1", [remitente_id])
          if (ur.rows[0]) {
            remitente_nombre = ur.rows[0].name || remitente_nombre
            if (!esRolPlaneacion(remitente_rol) && ur.rows[0].dependency_id) {
              if (String(data.dependency_id) !== String(ur.rows[0].dependency_id)) {
                if (!permitir(socket, false, `mensaje a la dependencia ${data.dependency_id} (la suya es ${ur.rows[0].dependency_id})`)) {
                  return socket.emit("chat_error", { mensaje: "No puedes escribir en ese chat" })
                }
              }
              dependency_id = ur.rows[0].dependency_id
            }
          }
        }

        if (!esRolPlaneacion(remitente_rol) && conversacion_id) {
          const cv = await pool.query(
            "SELECT 1 FROM chat_conversaciones WHERE id = $1 AND dependency_id = $2",
            [conversacion_id, dependency_id]
          )
          if (!cv.rowCount && !permitir(socket, false, `conversación ${conversacion_id} no pertenece a ${dependency_id}`)) {
            return socket.emit("chat_error", { mensaje: "No puedes escribir en esa conversación" })
          }
        }

        const msgRes = await pool.query(`
          INSERT INTO chat_mensajes
            (conversacion_id, remitente_id, remitente_nombre, remitente_rol,
             dependency_id, contenido, tipo,
             leido_planeacion, leido_dependencia)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING *
        `, [
          conversacion_id, remitente_id, remitente_nombre,
          remitente_rol, dependency_id, contenido.trim(), tipo,
          remitente_rol === "planeacion" || remitente_rol === "admin",
          remitente_rol === "dependencias"
        ])

        const mensaje = msgRes.rows[0]
        const esPlaneacion = esRolPlaneacion(remitente_rol)

        await pool.query(`
          UPDATE chat_conversaciones SET
            ultimo_mensaje = $1,
            ultimo_mensaje_at = NOW(),
            mensajes_no_leidos_planeacion = CASE
              WHEN $2 THEN mensajes_no_leidos_planeacion
              ELSE mensajes_no_leidos_planeacion + 1
            END,
            mensajes_no_leidos_dependencia = CASE
              WHEN $2 THEN mensajes_no_leidos_dependencia + 1
              ELSE mensajes_no_leidos_dependencia
            END
          WHERE id = $3
        `, [contenido.trim().substring(0, 100), esPlaneacion, conversacion_id])

        const sala = `chat_dep_${dependency_id}`
        io.to(sala).emit("chat_nuevo_mensaje", mensaje)
        io.to("chat_planeacion").emit("chat_nuevo_mensaje", mensaje)

        if (!esPlaneacion) {
          io.to("chat_planeacion").emit("chat_badge_update", { dependency_id, conversacion_id })
        }
      } catch (e) {
        console.error("Error guardando mensaje chat:", e)
        socket.emit("chat_error", { mensaje: "Error al enviar el mensaje" })
      }
    })

    socket.on("chat_escribiendo", ({ dependency_id, nombre, escribiendo } = {}) => {
      if (!permitir(socket, puedeVerDependencia(socket.user, dependency_id), `chat_escribiendo en ${dependency_id}`)) return
      socket.to(`chat_dep_${dependency_id}`).emit("chat_escribiendo", { nombre, escribiendo })
      socket.to("chat_planeacion").emit("chat_escribiendo", { dependency_id, nombre, escribiendo })
    })

    socket.on("disconnect", () => {
      console.log("Usuario desconectado:", socket.id)
    })
  })
}

module.exports = { registrarSockets }