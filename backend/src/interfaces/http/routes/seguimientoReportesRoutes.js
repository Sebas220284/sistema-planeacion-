const express = require("express")
const router  = express.Router()
const ctrl    = require("../controllers/seguimientoReportesController")


router.get("/anual",                    ctrl.reporteAnual)
router.get("/trimestral",               ctrl.reporteTrimestral)
router.get("/trianual",                 ctrl.reporteTrianual)
router.get("/dependencia/:dep_id",      ctrl.rendimientoDependencia)
router.get("/anios",                    ctrl.getAnios)

module.exports = router