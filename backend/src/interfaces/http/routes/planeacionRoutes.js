const express = require("express")
const router = express.Router()

const controller = require("../controllers/planeacionController")
console.log("Contenido del controlador:", controller);

router.get("/dashboard", controller.dashboard)

module.exports = router

