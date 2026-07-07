const express = require("express")
const router = express.Router()
const ctrl = require("../controllers/dependenciasController")

router.get("/",ctrl.listar)
router.put("/:id/contacto",ctrl.actualizarContacto)

module.exports = router