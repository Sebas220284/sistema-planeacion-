const express = require("express")
const router = express.Router()
const ctrl = require("../controllers/reportesController")

router.get("/programado-ejecutado", ctrl.programadoEjecutado)
router.get("/anios-disponibles", ctrl.aniosDisponibles)

module.exports = router