const express = require("express")
const router = express.Router()
const ctrl = require("../controllers/odsController")

router.get("/",                ctrl.getTodos)   
router.get("/lista",           ctrl.getLista)   
router.get("/stats",           ctrl.getStats)    
router.get("/buscar",          ctrl.buscar)     
router.get("/:numero",         ctrl.getUno)      
router.get("/:numero/metas",   ctrl.getMetas)    

module.exports = router