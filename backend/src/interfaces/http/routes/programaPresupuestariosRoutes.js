
const express = require("express")
const router = express.Router()
const c = require("../controllers/programapresupuestariosController")

// Rutas fijas primero (antes de "/:id") para que no se confundan con un id
router.get("/prefill", c.prefill)
router.get("/catalogos", c.catalogos)
router.get("/catalogos/unidades-responsables/:dependency_id", c.unidadesResponsables)
router.get("/catalogos/vinculacion/:dependency_id", c.catalogosVinculacion)
router.get("/vinculacion/lineas", c.lineasDisponibles)
router.get("/vinculacion", c.vinculacion)

// Ficha técnica y validación
router.get("/:id/ficha", c.obtenerFicha)
router.put("/:id/ficha", c.guardarFicha)
router.get("/:id/validacion", c.obtenerValidacion)
router.put("/:id/validacion", c.guardarValidacion)

module.exports = router

