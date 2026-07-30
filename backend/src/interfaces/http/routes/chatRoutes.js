const express = require("express")
const router = express.Router()
const ctrl = require("../controllers/chatController")

router.get("/conversaciones",ctrl.listarConversaciones)
router.get("/conversacion/:dependency_id",ctrl.obtenerOCrearConversacion)
router.get("/mensajes/:conversacion_id",ctrl.getMensajes)
router.post("/marcar-leido",ctrl.marcarLeido)
router.get("/stats",ctrl.getStats)

module.exports = router