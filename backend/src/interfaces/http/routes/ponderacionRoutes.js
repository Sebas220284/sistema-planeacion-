const express = require("express")
const router  = express.Router()
const ctrl    = require("../controllers/ponderacionController")

router.post("/calcular/:dependency_id/:anio",ctrl.calcularPonderacion)
router.get("/resumen/:dependency_id/:anio",ctrl.getResumen)
router.get("/global",ctrl.getResumenGlobal)

module.exports = router