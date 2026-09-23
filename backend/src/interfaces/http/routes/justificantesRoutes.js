const express = require("express")
const router  = express.Router()
const ctrl    = require("../controllers/justificantesController")


router.post("/subir", ctrl.subir)
router.get("/mios/:dependency_id", ctrl.listarMios)
router.get("/descargar/:id", ctrl.descargar)
router.delete("/:id", ctrl.eliminar)

router.get("/todos", ctrl.listarTodos)
router.put("/:id/revisar", ctrl.revisar)

module.exports = router