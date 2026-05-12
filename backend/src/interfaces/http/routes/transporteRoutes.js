const express = require('express');
const router = express.Router();
const transporteCtrl = require('../controllers/transporteAuth');

// --- ESTA ES LA LÍNEA QUE TE FALTA ---
// Asegúrate de que la ruta al archivo sea la correcta en tu proyecto
const { validarTokenTransporte } = require('../middlewares/authMiddleware'); 

// Ahora ya no dará error en esta línea
router.post('/login', transporteCtrl.loginTransporte);

router.get('/rutas-activas', validarTokenTransporte, (req, res) => {
    res.json({ mensaje: "Lista de rutas obtenida con éxito" });
});

module.exports = router;