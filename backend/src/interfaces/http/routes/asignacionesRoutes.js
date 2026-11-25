const express = require("express")
const router = express.Router()
const ctrl = require("../controllers/asignacionesController")
const roleMiddleware = require("../middlewares/roleMiddleware")

router.use(roleMiddleware(["admin", "superadmin"]))

router.post("/asignar",ctrl.asignar)
router.get("/usuario/:user_id",ctrl.getAsignadas)
router.delete("/usuario/:user_id",ctrl.quitarRestriccion)

module.exports = router