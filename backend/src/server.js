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
//"http://localhost:5173",

]

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true)

    if (allowedOrigins.includes(origin)) {
      return callback(null, true)
    }

    return callback(new Error("Acceso no autorizado."))
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
app.use(express.json())
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

app.use("/api/auth",authRoutes)
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
