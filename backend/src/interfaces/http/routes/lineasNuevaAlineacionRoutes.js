const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/lineasNuevaAlineacionController");

router.post("/", ctrl.crearLineaAccion);
router.get("/estrategia/:alineacion_id", ctrl.obtenerLineasPorEstrategia);
router.delete("/:id", ctrl.eliminarLineaAccion);

module.exports = router;
