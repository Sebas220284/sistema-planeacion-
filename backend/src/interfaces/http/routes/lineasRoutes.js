const express = require("express")
const router = express.Router()
const controller = require("../controllers/lineasController")

router.post("/nueva", controller.nueva)
router.get("/pendientes", controller.getPendientes)
router.put("/aprobar/:id", controller.aprobar)
router.put("/rechazar/:id", controller.rechazar)
router.delete("/eliminar/:id", controller.eliminar)
router.put("/editar-texto/:id", controller.actualizarTexto)
module.exports = router