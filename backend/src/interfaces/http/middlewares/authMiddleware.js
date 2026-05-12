const jwt = require("jsonwebtoken")

module.exports = (req,res,next)=>{

const authHeader = req.headers.authorization

if(!authHeader){
return res.status(401).json({error:"Token requerido"})
}

const token = authHeader.split(" ")[1]

try{

const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")

req.user = decoded

next()

}catch(error){

return res.status(401).json({error:"Token inválido"})

}

}
exports.loginTransporte = async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM transporte.usuarios WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Usuario no encontrado" });

        const user = result.rows[0];
        const validPw = await bcrypt.compare(password, user.password);
        if (!validPw) return res.status(401).json({ error: "Credenciales inválidas" });

        const token = jwt.sign(
            { id: user.id, rol: user.rol, app: 'transporte' }, 
            process.env.JWT_SECRET_TRANSPORTE, 
            { expiresIn: '8h' }
        );

        res.json({ token, user: { nombre: user.nombre, rol: user.rol } });
    } catch (err) {
        res.status(500).send("Error en el servidor");
    }
};
exports.validarTokenTransporte = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Acceso denegado" });

    try {
        const verificado = jwt.verify(token, process.env.JWT_SECRET_TRANSPORTE);
        if (verificado.app !== 'transporte') throw new Error("Token no pertenece a esta app");
        
        req.user = verificado;
        next();
    } catch (err) {
        res.status(403).json({ error: "Token inválido o expirado para Transporte" });
    }
};

