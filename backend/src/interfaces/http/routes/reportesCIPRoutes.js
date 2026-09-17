const express = require("express")
const router  = express.Router()
const ctrl = require("../controllers/reportesCIPController")

router.get("/cip/reporte1", ctrl.reporte1)
<<<<<<< HEAD
router.get("/cip/anios",    ctrl.getAnios)
router.get("/cip/reporte2", ctrl.reporte2)
=======
router.get("/cip/reportePorEje", ctrl.reportePorEje)
router.get("/cip/anios", ctrl.getAnios)
>>>>>>> 4dd486ee6aab31ccb2aa264898bb7a628317f2d5

module.exports = router