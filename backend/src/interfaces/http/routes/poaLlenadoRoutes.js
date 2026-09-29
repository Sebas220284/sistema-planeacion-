const express = require("express")
const router  = express.Router()
const ctrl    = require("../controllers/poaLlenadoController")


router.get("/panel",                 ctrl.getPanelLlenado)
router.get("/exportar",              ctrl.getExportData)
router.get("/dependencia/:dep_id",   ctrl.getDetalleDependencia)

module.exports = router