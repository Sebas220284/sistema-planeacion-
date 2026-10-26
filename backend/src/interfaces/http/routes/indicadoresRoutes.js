const express = require("express")
const router = express.Router()
const controller = require("../controllers/indicadoresController")

function soloPlaneacion(req, res, next) {
  const rol = req.user?.rol || req.user?.role
  if (["admin", "planeacion"].includes(rol)) return next()
  return res.status(403).json({ error: "Sin permiso" })
}

router.get("/", controller.listar)
router.get("/ejes", controller.ejes)
router.get("/por-eje/:eje", controller.porEje)
router.get("/por-estrategia/:strategy_id", controller.porEstrategia)
router.put("/:clave", soloPlaneacion, controller.actualizar)

module.exports = router
