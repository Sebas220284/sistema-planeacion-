const express = require("express")
const router = express.Router()
const controller = require("../controllers/pdfController")

router.post("/habilitar", controller.habilitar)
router.get("/habilitados/:dependency_id", controller.getHabilitados)
router.get("/todos/:dependency_id", controller.getTodos)

module.exports = router
