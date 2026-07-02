const express = require("express")
const router = express.Router()

const controller = require("../controllers/trimestresController")

router.post("/guardar", controller.save)
router.get("/porLinea/:planning_id", controller.getByLinea)
router.put("/editar-directo", controller.editarDirecto)
router.get("/completo/:linea_id", controller.porLineaCompleto)
module.exports = router