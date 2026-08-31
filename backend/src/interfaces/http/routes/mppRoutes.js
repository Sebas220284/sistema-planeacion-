const express = require("express")
const router  = express.Router()
const ctrl    = require("../controllers/mppController")

router.get("/dashboard",              ctrl.dashboard)
router.get("/",                       ctrl.listar)
router.get("/todos",                  ctrl.listarTodos)
router.get("/:id/exportar",          ctrl.exportar)
router.get("/:id",                    ctrl.obtener)
router.post("/",                      ctrl.guardarMaestro)
router.put("/:id",                    ctrl.guardarMaestro)
router.post("/:documento_id/detalle", ctrl.guardarDetalle)
router.put("/:documento_id/detalle",  ctrl.guardarDetalle)
router.patch("/:id/estado",           ctrl.cambiarEstado)
router.delete("/:id",                 ctrl.eliminar)

module.exports = router