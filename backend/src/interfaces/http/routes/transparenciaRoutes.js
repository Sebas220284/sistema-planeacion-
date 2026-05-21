const express = require("express")
const router = express.Router()
const ctrl = require("../controllers/transparenciaController")

router.get("/seccion4", ctrl.getSeccion4)
router.get("/config/:seccion", ctrl.getConfig)
router.put("/config/:seccion", ctrl.updateConfig)

module.exports = router