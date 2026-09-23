const express = require("express")
const router = express.Router()
const controller = require("../controllers/lineasController")
const roleMiddleware = require("../middlewares/roleMiddleware")

// Nueva linea propuesta por dependencias (no protegida por admin)
router.post("/nueva", controller.nueva)
router.get("/pendientes", controller.getPendientes)

// Rutas de gestin y aprobacin (solo admins)
router.use(roleMiddleware(["admin", "superadmin"]));

router.put("/aprobar/:id", controller.aprobar)
router.put("/rechazar/:id", controller.rechazar)
router.delete("/eliminar/:id", controller.eliminar)
router.put("/toggle-activa/:id", controller.toggleActiva)
router.put("/editar-texto/:id", controller.actualizarTexto)
module.exports = router