const express = require("express")
const router = express.Router()
const ctrl = require("../controllers/dependenciasController")
const roleMiddleware = require("../middlewares/roleMiddleware")

router.get("/",ctrl.listar)
router.put("/:id/contacto", roleMiddleware(["admin", "superadmin"]), ctrl.actualizarContacto)

module.exports = router