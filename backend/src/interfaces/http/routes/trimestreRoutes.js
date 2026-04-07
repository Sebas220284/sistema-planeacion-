const express = require("express")
const router = express.Router()

const controller = require("../controllers/trimestresController")

router.post("/guardar", controller.save)
router.get("/porLinea/:planning_id", controller.getByLinea)
module.exports = router