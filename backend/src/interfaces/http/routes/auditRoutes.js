const express = require("express")
const router  = express.Router()
const ctrl    = require("../controllers/auditController")
const { verificarToken, soloAdmin } = require("../middlewares/authMiddleware")

router.use(verificarToken)
router.use(soloAdmin)

router.get("/",ctrl.listar)
router.get("/stats", ctrl.getStats)
router.get("/exportar",ctrl.exportar)

module.exports = router