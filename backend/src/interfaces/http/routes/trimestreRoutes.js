const express = require("express")
const router = express.Router()

const controller = require("../controllers/trimestres.controller")

router.post("/trimestre",controller.save)

module.exports = router