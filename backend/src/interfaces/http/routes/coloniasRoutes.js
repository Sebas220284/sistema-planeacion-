const express = require("express")
const router  = express.Router()
const ctrl    = require("../controllers/coloniasController")

router.get("/buscar",   ctrl.buscar)
router.get("/zonas",    ctrl.getZonas)
router.get("/",         ctrl.listar)
router.post("/",        ctrl.agregar)

module.exports = router