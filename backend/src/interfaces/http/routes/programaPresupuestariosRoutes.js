
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

// CRUD que usa el frontend actual (ProgramasPresupuestarios.jsx)
router.get("/", c.listar)
router.get("/:id", c.obtener)
router.post("/", c.crear)
router.put("/:id", c.actualizar)
router.patch("/:id/estatus", c.cambiarEstatus)
router.delete("/:id", c.eliminar)

module.exports = router
