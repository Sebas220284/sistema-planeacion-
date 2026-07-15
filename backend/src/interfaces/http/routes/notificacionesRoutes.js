const express = require('express');
const router = express.Router();
const notificacionesController = require('../controllers/notificacionesController');

router.get('/', notificacionesController.getNotificaciones);
router.put('/:id/leida', notificacionesController.marcarLeida);
router.put('/marcar-todas', notificacionesController.marcarTodasLeidas);

module.exports = router;
