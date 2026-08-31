const express = require("express")
const router = express.Router()
const ctrl = require("../controllers/usersController")
const roleMiddleware = require("../middlewares/roleMiddleware")

// Solo los administradores pueden gestionar usuarios
router.use(roleMiddleware(["admin", "superadmin"]));

router.get("/",ctrl.listar)
router.get("/roles",ctrl.getRoles)
router.get("/:id",ctrl.obtener)
router.post("/",ctrl.crear)
router.put("/:id",ctrl.actualizar)
router.put("/:id/password",ctrl.cambiarPassword)
router.delete("/:id",ctrl.eliminar)

module.exports = router