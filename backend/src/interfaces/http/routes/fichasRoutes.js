const express = require("express")
const router = express.Router()
const controller = require("../controllers/fichasController")

router.post("/crear", controller.crear)
router.get("/lista", controller.lista)
router.get("/porDependencia/:dependency_id", controller.porDependencia)
router.put("/actualizar/:id", controller.actualizar)
router.delete("/eliminar/:id", controller.eliminar)
router.get("/estrategias/:dependency_id", controller.estrategiasPorDependencia)

module.exports = router