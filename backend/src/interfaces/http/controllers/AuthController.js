const PostgresUserRepository = require("../../../infrastructure/repositories/PostgresUserRepository")
const LoginUser = require("../../../application/use-cases/LoginUser")
const GetCurrentUser = require("../../../application/use-cases/GetCurrentUser")
const auditCtrl = require("./auditController")
const jwt = require("jsonwebtoken")

const userRepository = new PostgresUserRepository()

const obtenerIP = (req) => {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.headers["x-real-ip"]
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || "0.0.0.0"
}

exports.login = async (req,res) => {
  const { email, password } = req.body;
  const ip_address = obtenerIP(req);
  const user_agent = req.headers["user-agent"] || "";
  
  try {
    const loginUser = new LoginUser(userRepository)
    const token = await loginUser.execute(email,password)
    
    // Decodificar el token para obtener info basica del usuario
    const decoded = jwt.decode(token);
    
    // Registrar exito
    await auditCtrl.registrar({
      user_id: decoded?.id,
      user_name: decoded?.name || "Usuario",
      user_email: email,
      rol_nombre: decoded?.rol || "Desconocido",
      ip_address,
      user_agent,
      accion: "login",
      descripcion: "Inicio de sesin exitoso",
      ruta: "/api/auth/login",
      exitoso: true
    }).catch(e => console.error(e));
    
    res.json({ token })
    
  } catch(error) {
    // Registrar intento fallido
    await auditCtrl.registrar({
      user_id: null,
      user_name: "Desconocido",
      user_email: email,
      rol_nombre: "Desconocido",
      ip_address,
      user_agent,
      accion: "login",
      descripcion: "Intento fallido de inicio de sesin",
      ruta: "/api/auth/login",
      exitoso: false,
      detalle_error: error.message
    }).catch(e => console.error(e));

    res.status(400).json({ error: error.message })
  }
}

exports.me = async (req,res)=>{

  try{

    const getCurrentUser = new GetCurrentUser(userRepository)

    const user = await getCurrentUser.execute(req.user.id)

    res.json(user)

  }catch(error){

    res.status(400).json({error:error.message})

  }

}

