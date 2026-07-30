const express = require("express")
const router = express.Router()
const ctrl = require("../controllers/asignacionesController")

router.post("/asignar",ctrl.asignar)
router.get("/usuario/:user_id",ctrl.getAsignadas)
router.delete("/usuario/:user_id",ctrl.quitarRestriccion)

module.exports = router