const express = require("express")
const router  = express.Router()
const ctrl    = require("../controllers/semaforoController")

router.get("/lineas",                     ctrl.getLineas)
router.get("/dependencias",               ctrl.getResumenDependencias)
router.get("/dependencias/:dep_id",       ctrl.getDetalleDependencia)
router.get("/ejes",                       ctrl.getResumenEjes)
router.get("/ejes/:eje_num",              ctrl.getDetalleEje)
router.get("/anios",                      ctrl.getAnios)

module.exports = router
