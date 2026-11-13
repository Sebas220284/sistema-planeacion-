
const express = require("express")
const router = express.Router()
const c = require("../controllers/programasPresupuestariosFichaController")

router.get("/vinculacion/lineas", c.lineasDisponibles)
router.get("/vinculacion", c.vinculacion)
router.get("/:id/ficha", c.obtenerFicha)
router.put("/:id/ficha", c.guardarFicha)
router.get("/:id/validacion", c.obtenerValidacion)
router.put("/:id/validacion", c.guardarValidacion)

module.exports = router