const express = require("express");
const router = express.Router();
const estrategicaController = require("../controllers/estrategicaController");

router.post("/", estrategicaController.crearPlaneacion);
router.get("/ejes", estrategicaController.obtenerEjes);
router.get("/dependencia/:dependencia_id", estrategicaController.obtenerAlineacionPorDependencia);

router.get("/estrategias-existentes", estrategicaController.obtenerEstrategiasExistentes);
module.exports = router;

