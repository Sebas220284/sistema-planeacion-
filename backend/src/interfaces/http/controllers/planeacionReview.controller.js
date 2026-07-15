const PostgresPlanningRepository = require("../../../infrastructure/repositories/PostgresPlanningRepository")
const ReviewTrimestre = require("../../../application/use-cases/ReviewTrimestre")
const NotificationService = require("../../../application/services/NotificationService")

const repository = new PostgresPlanningRepository()

exports.review = async (req, res) => {
  try {
    const useCase = new ReviewTrimestre(repository)
    const data = await useCase.execute({ id: req.params.id, ...req.body })

    const io = req.app.get("io")

    // Notificación a la dependencia
    await NotificationService.sendNotification(io, {
      dependency_id: req.body.dependency_id,
      tipo: 'revision',
      titulo: 'Revisión de Trimestre',
      mensaje: `Tu trimestre ${data.trimestre} (${data.tipo}) ha sido ${data.estado_revision}. ${data.comentario_revision || ''}`,
    }, req.body.dependency_id)
    
    // Emitir eventos originales de UI update
    io.to(req.body.dependency_id).emit("planeacion_reviso", {
      planning_id: data.planning_id,
      estado: data.estado_revision,
      comentario: data.comentario_revision,
      trimestre: data.trimestre,
      anio: data.anio,
      tipo: data.tipo,
      mensaje: `Tu trimestre fue ${data.estado_revision}`
    })

    io.to(req.body.dependency_id).emit("planeacion_enviada", {
      planning_id: data.planning_id,
      comentario: data.comentario_revision,
      trimestre: data.trimestre,
      anio: data.anio,
      tipo: data.tipo,
      mensaje: `Trimestre Pendiente por revisar ${data}`
    })

    io.to("planeacion").emit("revision-trimestre", data)

    res.json(data)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error revisando trimestre" })
  }
}
