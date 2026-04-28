const express = require("express")
const router = express.Router()

const controller = require("../controllers/planeacionController")
console.log("Contenido del controlador:", controller);

router.get("/dashboard", controller.dashboard)
router.get("/reportes", controller.reportes)

module.exports = router

