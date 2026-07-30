const express = require('express');
const router = express.Router();
const transporteCtrl = require('../controllers/transporteAuth');

const { validarTokenTransporte } = require('../middlewares/authMiddleware'); 

router.post('/login', transporteCtrl.loginTransporte);

router.get('/rutas-activas', validarTokenTransporte, (req, res) => {
    res.json({ mensaje: "Lista de rutas obtenida con éxito" });
});

module.exports = router;