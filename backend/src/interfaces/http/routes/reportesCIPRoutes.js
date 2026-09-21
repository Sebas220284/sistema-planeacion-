const express = require("express")
const router  = express.Router()
const ctrl = require("../controllers/reportesCIPController")

router.get("/cip/reporte1", ctrl.reporte1)
router.get("/cip/reportePorEje", ctrl.reportePorEje)
router.get("/cip/anios",    ctrl.getAnios)
router.get("/cip/reporte2", ctrl.reporte2)
router.get("/cip/reporteLineasAccion", ctrl.reporteLineasAccion)

module.exports = router