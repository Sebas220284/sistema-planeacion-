const express = require("express")
const router  = express.Router()
const ctrl    = require("../controllers/potController")

router.get("/",                     ctrl.listar)
router.get("/resumen",              ctrl.resumen)
router.get("/dependencia/:dep_id",  ctrl.porDependencia)
router.get("/:id",                  ctrl.obtener)
router.put("/:id",                  ctrl.actualizar)

module.exports = router