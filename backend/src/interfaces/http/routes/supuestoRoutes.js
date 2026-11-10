const express = require("express")
const router = express.Router()
const controller = require("../controllers/supuestosController")

router.get("/", controller.listar)
router.get("/por-estrategia/:strategy_id", controller.porEstrategia)
router.get("/por-clave/:clave", controller.porClave)

router.post("/", controller.soloPlaneacion, controller.crear)
router.put("/:id", controller.soloPlaneacion, controller.actualizar)
router.delete("/:id", controller.soloPlaneacion, controller.eliminar)

module.exports = router