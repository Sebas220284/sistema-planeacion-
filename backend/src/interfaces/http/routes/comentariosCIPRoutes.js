const express = require("express")
const router  = express.Router()
const ctrl    = require("../controllers/comentariosCIPController")


router.get("/resumen-global",              ctrl.resumenGlobal)
router.get("/:proyecto_id",               ctrl.listar)
router.post("/:proyecto_id",              ctrl.agregar)
router.put("/comentario/:id",             ctrl.editar)
router.put("/comentario/:id/responder",   ctrl.responder)
router.put("/comentario/:id/estado",      ctrl.cambiarEstado)
router.delete("/comentario/:id",          ctrl.eliminar)

module.exports = router