const express = require("express")
const router = express.Router()

const controller = require("../controllers/planeacionReview.controller")

router.put("/:id",controller.review)

module.exports = router