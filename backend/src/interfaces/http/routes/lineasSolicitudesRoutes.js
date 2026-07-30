const express = require("express")
const router = express.Router()
const ctrl = require("../controllers/lineasSolicitudesController")


router.get("/mias/:dependency_id",ctrl.listarMias)
router.post("/",ctrl.crear)
router.put("/:id",ctrl.actualizar)
router.put("/:id/enviar",ctrl.enviar)
router.delete("/:id",ctrl.eliminar)


router.get("/",ctrl.listarTodas)
router.get("/stats",ctrl.getStats)
router.put("/:id/aprobar",ctrl.aprobar)
router.put("/:id/rechazar",ctrl.rechazar)
router.put("/:id/habilitar-pdf",ctrl.habilitarPDF)
router.post("/pasar-al-poa",ctrl.pasarAlPOA)

module.exports = router