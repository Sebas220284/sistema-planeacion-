const express = require("express")
const router = express.Router()

const controller = require("../controllers/trimestresController")
const roleMiddleware = require("../middlewares/roleMiddleware")

router.post("/guardar",controller.save)
router.get("/porLinea/:planning_id",controller.getByLinea)
router.put("/editar-directo", roleMiddleware(["admin", "superadmin"]), controller.editarDirecto)
router.get("/completo/:linea_id",controller.porLineaCompleto)
module.exports = router