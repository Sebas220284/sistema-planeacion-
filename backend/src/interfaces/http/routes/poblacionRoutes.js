const express = require("express")
const router  = express.Router()
const ctrl    = require("../controllers/poblacionController")

router.get("/",     ctrl.getTodos)
router.get("/:id",  ctrl.getUno)

module.exports = router