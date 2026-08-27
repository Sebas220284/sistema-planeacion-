require("dotenv").config()

const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const db = require("./database/postgres")
const authRoutes = require("./interfaces/http/routes/authRoutes")
const trimestresRoutes = require("./interfaces/http/routes/trimestreRoutes")
const planeacionRoutes = require("./interfaces/http/routes/planeacionRoutes")
const planeacionReviewRoutes = require("./interfaces/http/routes/planeacionReview.routes")
const lineasRoutes= require("./interfaces/http/routes/lineasRoutes")
const pdfRoutes = require("./interfaces/http/routes/pdfRoutes")
const pmdRoutes = require("./interfaces/http/routes/pmdRoutes")
const fichasRoutes = require("./interfaces/http/routes/fichasRoutes")
const transparenciaRoutes = require("./interfaces/http/routes/transparenciaRoutes")
const cipRoutes = require("./interfaces/http/routes/cipRoutes")
const reportesRoutes = require("./interfaces/http/routes/reportesRoutes")
///const transporteRoutes = require("./interfaces/http/routes/transporteRoutes")
const usersRoutes = require("./interfaces/http/routes/usersRoutes")
const asignacionesRoutes = require("./interfaces/http/routes/asignacionesRoutes")
const dependenciasRoutes = require("./interfaces/http/routes/dependenciasRoutes")
const notificacionesRoutes = require("./interfaces/http/routes/notificacionesRoutes")
const odsRoutes = require("./interfaces/http/routes/odsRoutes")
const chatRoutes = require("./interfaces/http/routes/chatRoutes")
const lineasSolRoutes = require("./interfaces/http/routes/lineasSolicitudesRoutes")
const ponderacionRoutes = require("./interfaces/http/routes/ponderacionRoutes")
const poblacionRoutes = require("./interfaces/http/routes/poblacionRoutes")
const potRoutes = require("./interfaces/http/routes/potRoutes")
const coloniasRoutes = require("./interfaces/http/routes/coloniasRoutes")
const semaforoRoutes = require("./interfaces/http/routes/semaforoRoutes")


const app = express()
const server = http.createServer(app)

const io = new Server(server,{
  cors:{
    origin:"*",
    methods:["GET","POST","PUT","DELETE"]
  }
})


const allowedOrigins=[
"https://planeacion.tuxtla.gob.mx",
"http://localhost:5173",
"http://localhost:5174"

]

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    return callback(new Error("FATAL ERROR."))
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}))
app.set("io", io)
io.on("connection",(socket)=>{
  console.log("Usuario conectado:",socket.id)

  socket.on("join_room",(dependency_id)=>{
    socket.join(dependency_id)
    console.log(`Socket ${socket.id} se unió al room ${dependency_id}`)
  })

  socket.on("join_planeacion",()=>{
    socket.join("planeacion")
    console.log(`Planeación conectada: ${socket.id}`)
  })

  socket.on("disconnect",()=>{
    console.log("Usuario desconectado:",socket.id)
  })
})

const ioTransporte = io.of('/transporte');
ioTransporte.on('connection', (socket) => {
    console.log('Conectado a Transporte');
    
    socket.on('actualizar_ubicacion', (coords) => {
        ioTransporte.emit('bus_moviéndose', coords);
    });
});
app.use(express.json({ limit: '10mb' }))
async function checkDatabase(){

  try{

    const res = await db.query("SELECT NOW()")

    console.log("PostgreSQL conectado:",res.rows[0])

  }catch(error){

    console.error("Error conexión DB:",error)
  //  process.exit(1)

  }

}
checkDatabase()

app.get("/",(req,res)=>{

  res.json({
    status:"OK",
    service:"API Planeacion POA",
    time:new Date()
  })

})

const authMiddleware = require("./interfaces/http/middlewares/authMiddleware")

app.use("/api/auth",authRoutes)

// Proteger todas las demas rutas
app.use("/api", authMiddleware)

app.use("/api/trimestres",trimestresRoutes)
app.use("/api/planeacion",planeacionRoutes)
app.use("/api/review",planeacionReviewRoutes)
//app.use("/api/lineas")
app.use("/api/lineas", lineasRoutes)
app.use("/api/pdf", pdfRoutes)
app.use("/api/pmd", pmdRoutes)
app.use("/api/fichas", fichasRoutes)
//app.use('/api/v1/transporte', transporteRoutes);
app.use("/api/transparencia", transparenciaRoutes)
app.use("/api/cip", cipRoutes)
app.use("/api/reportes", reportesRoutes)
app.use("/api/usuarios", usersRoutes)
app.use("/api/asignaciones", asignacionesRoutes)
app.use("/api/dependencias", dependenciasRoutes)
app.use("/api/notificaciones", notificacionesRoutes)
app.use("/api/ods", odsRoutes)
app.use("/api/chat", chatRoutes)
app.use("/api/lineas-solicitudes", lineasSolRoutes)
app.use("/api/ponderacion", ponderacionRoutes)
app.use("/api/poblacion-grupos", poblacionRoutes)
app.use("/api/pot", potRoutes)
app.use("/api/colonias", coloniasRoutes)
app.use("/api/semaforo", semaforoRoutes)

io.on("connection", (socket) => {

  socket.on("chat_join", ({ dependency_id, user_id, rol }) => {
    const sala = `chat_dep_${dependency_id}`
    socket.join(sala)
    socket.join("chat_planeacion") 
    console.log(`Chat: user ${user_id} (${rol}) unido a sala ${sala}`)
  })

  socket.on("chat_mensaje", async (data) => {
    const {
      conversacion_id, dependency_id,
      remitente_id, remitente_nombre, remitente_rol,
      contenido, tipo = "texto"
    } = data

    if (!contenido?.trim() && tipo === "texto") return

    try {
      const pool = require("./database/postgres")

      const msgRes = await pool.query(`
        INSERT INTO chat_mensajes
          (conversacion_id, remitente_id, remitente_nombre, remitente_rol,
           dependency_id, contenido, tipo,
           leido_planeacion, leido_dependencia)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
      `, [
        conversacion_id, remitente_id || null, remitente_nombre,
        remitente_rol, dependency_id, contenido.trim(), tipo,
        remitente_rol === "planeacion" || remitente_rol === "admin",  
        remitente_rol === "dependencias"  
      ])

      const mensaje = msgRes.rows[0]

      const esPlaneacion = ["planeacion","admin"].includes(remitente_rol)
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
        io.to("chat_planeacion").emit("chat_badge_update", {
          dependency_id,
          conversacion_id
        })
      }

    } catch(e) {
      console.error("Error guardando mensaje chat:", e)
      socket.emit("chat_error", { mensaje: "Error al enviar el mensaje" })
    }
  })

 
  socket.on("chat_escribiendo", ({ dependency_id, nombre, escribiendo }) => {
    const sala = `chat_dep_${dependency_id}`
    socket.to(sala).emit("chat_escribiendo", { nombre, escribiendo })
    socket.to("chat_planeacion").emit("chat_escribiendo", { dependency_id, nombre, escribiendo })
  })

  socket.on("disconnect", () => {})
})


app.use((req,res)=>{

  res.status(404).json({
    error:"Ruta no encontrada"
  })

})
app.use((err,req,res,next)=>{

  console.error("Error:",err)

  res.status(500).json({
    error:"Error interno del servidor"
  })

})

const PORT = process.env.PORT || 3100

server.listen(PORT,"0.0.0.0",()=>{

  console.log("Servidor corriendo en puerto",PORT)

  console.log(`http://localhost:${PORT}`)

}) 
