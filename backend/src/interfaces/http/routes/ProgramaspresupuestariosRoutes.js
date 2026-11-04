const express = require("express")
const router = express.Router()
const controller = require("../controllers/programasPresupuestariosController")

router.get("/prefill", controller.prefill)
router.get("/", controller.listar)
router.get("/:id", controller.obtener)
router.post("/", controller.crear)
router.put("/:id", controller.actualizar)
router.patch("/:id/estatus", controller.cambiarEstatus)
router.delete("/:id", controller.eliminar)

module.exports = router