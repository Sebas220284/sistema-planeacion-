const express = require("express")
const router  = express.Router()
const ctrl = require("../controllers/reportesCIPController")

router.get("/cip/reporte1", ctrl.reporte1)
router.get("/cip/anios", ctrl.getAnios)

module.exports = router