const express = require("express")
const router = express.Router()
const ctrl = require("../controllers/cipController")

// Catálogos
router.get("/catalogos/programas",     ctrl.getCatProgramas)
router.get("/catalogos/subprogramas/:prog", ctrl.getCatSubprogramas)
router.get("/catalogos/partidas",      ctrl.getCatPartidas)
router.get("/catalogos/fuentes",       ctrl.getCatFuentes)
router.get("/catalogos/pmd/:dep_id",   ctrl.getPMDPorDependencia)

// CIP CRUD
router.get("/",               ctrl.listar)
router.get("/:id",            ctrl.obtener)
router.post("/",              ctrl.crear)
router.put("/:id",            ctrl.actualizar)
router.delete("/:id",         ctrl.eliminar)
router.put("/:id/estado",     ctrl.cambiarEstado)

// Sub-recursos
router.get("/:id/desglose",        ctrl.getDesglose)
router.post("/:id/desglose",       ctrl.agregarDesglose)
router.put("/desglose/:did",       ctrl.actualizarDesglose)
router.delete("/desglose/:did",    ctrl.eliminarDesglose)

router.get("/:id/metas",           ctrl.getMetas)
router.post("/:id/metas",          ctrl.agregarMeta)
router.put("/metas/:mid",          ctrl.actualizarMeta)
router.delete("/metas/:mid",       ctrl.eliminarMeta)
router.get("/catalogos/dependencias", ctrl.getDependencias)
router.get("/:id/exportar", ctrl.obtenerParaExportar)


module.exports = router