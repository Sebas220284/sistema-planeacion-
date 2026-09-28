const express = require("express")
const router  = express.Router()
const ctrl    = require("../controllers/auditController")
const roleMiddleware = require("../middlewares/roleMiddleware")

router.use(roleMiddleware(["admin", "superadmin"]))

router.get("/",ctrl.listar)
router.get("/stats", ctrl.getStats)
router.get("/exportar",ctrl.exportar)

module.exports = router