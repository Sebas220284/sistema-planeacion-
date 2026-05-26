const express = require("express")
const router = express.Router()
const ctrl = require("../controllers/transparenciaController")

// Sección 4
router.get("/seccion4", ctrl.getSeccion4)

// Sección 5
router.get("/seccion5", ctrl.getSeccion5)
router.post("/seccion5", ctrl.crearSeccion5)
router.put("/seccion5/:id", ctrl.actualizarSeccion5)
router.delete("/seccion5/:id", ctrl.eliminarSeccion5)

// Config compartida
router.get("/config/:seccion", ctrl.getConfig)
router.put("/config/:seccion", ctrl.updateConfig)

module.exports = router