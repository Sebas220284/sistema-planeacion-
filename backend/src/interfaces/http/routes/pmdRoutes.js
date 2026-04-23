const express = require("express")
const router = express.Router()
const controller = require("../controllers/pmdController")

router.post("/crear", controller.crear)
router.get("/lista", controller.lista)
router.put("/revisar/:id", controller.revisar)

module.exports = router