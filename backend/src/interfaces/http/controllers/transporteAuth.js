const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../../database/postgres'); 

// Login único para la App de Transporte
exports.loginTransporte = async (req, res) => {
    const { email, password } = req.body;
    try {
        // Buscamos en la tabla específica de transporte (usa el esquema si lo creaste)
        const result = await pool.query('SELECT * FROM transporte.usuarios WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Usuario de transporte no encontrado" });
        }

        const user = result.rows[0];
        const validPw = await bcrypt.compare(password, user.password);

        if (!validPw) {
            return res.status(401).json({ error: "Contraseña incorrecta" });
        }

        // Usamos un SECRET diferente para que esta sesión no sirva en el sistema de gobierno
        const token = jwt.sign(
            { id: user.id, rol: user.rol, proyecto: 'transporte' }, 
            process.env.JWT_SECRET_TRANSPORTE || 'clave_transporte_qr_99', 
            { expiresIn: '12h' }
        );

        res.json({
            token,
            user: { id: user.id, nombre: user.nombre, rol: user.rol }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error en el servidor de transporte" });
    }
};