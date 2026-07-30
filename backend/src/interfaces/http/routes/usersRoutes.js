const express = require("express")
const router = express.Router()
const ctrl = require("../controllers/usersController")

router.get("/",ctrl.listar)
router.get("/roles",ctrl.getRoles)
router.get("/:id",ctrl.obtener)
router.post("/",ctrl.crear)
router.put("/:id",ctrl.actualizar)
router.put("/:id/password",ctrl.cambiarPassword)
router.delete("/:id",ctrl.eliminar)

module.exports = router