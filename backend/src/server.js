require("dotenv").config()
console.log("ENV DB:", {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME
})
const express = require("express")
const http= require("http")
const {Server}=require("socket.io")
const cors = require("cors")

const db = require("./database/postgres")
const authRoutes = require("./interfaces/http/routes/authRoutes")
const planeacionRoutes = require("./interfaces/http/routes/planeacionRoutes")
const app = express()
const server= http.createServer(app)

const io= new Server(server,{
  cors:{origin:"*"}
})

app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","DELETE"]
}))

app.use(express.json())


io.on("connection",(socket)=>{
  console.log("Usuario Conectado:)",socket.id)
})
// verificar conexión a la base de datos
async function checkDatabase() {
  try {

    const res = await db.query("SELECT NOW()")

    console.log("✅ PostgreSQL conectado:", res.rows[0])

  } catch (error) {

    console.error("❌ Error conexión DB:", error)
    process.exit(1)

  }
}

checkDatabase()
db.query("SELECT current_database(), inet_server_addr(), inet_server_port()")
  .then(res => console.log("CONEXION REAL:", res.rows))
  .catch(err => console.error(err))


db.query("SELECT current_database(), current_user")
  .then(res => console.log("DB INFO:", res.rows))
  .catch(err => console.error(err))
  db.query(`
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema='public'
`)

.then(res => console.log("TABLAS PUBLIC:", res.rows))
.catch(err => console.error(err))
// ruta principal
app.get("/", (req, res) => {
  res.json({
    status: "OK",
    service: "API Planeacion",
    time: new Date()
  })
})


// rutas de autenticación
app.use("/api/auth", authRoutes)
app.use("/api/planeacion", planeacionRoutes)

// ruta no encontrada
app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada"
  })
})


// manejo de errores
app.use((err, req, res, next) => {

  console.error("🔥 Error:", err)

  res.status(500).json({
    error: "Error interno del servidor"
  })

})


const PORT = process.env.PORT || 3000

server.listen(PORT, () => {


  console.log(` Servidor corriendo en puerto ${PORT}`)
  console.log(`http://localhost:${PORT}`)
  

})