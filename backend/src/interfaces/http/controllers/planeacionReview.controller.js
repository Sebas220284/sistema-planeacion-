const PostgresPlanningRepository = require("../../../infrastructure/repositories/PostgresPlanningRepository")

const ReviewTrimestre = require("../../../application/use-cases/ReviewTrimestre")

const repository = new PostgresPlanningRepository()

exports.review = async (req, res) => {
  try {
    const useCase = new ReviewTrimestre(repository)
    const data = await useCase.execute({ id: req.params.id, ...req.body })

    req.app.get("io").emit("revision-trimestre", data)
    req.app.get("io").emit("planeacion_reviso", {
      planning_id: data.planning_id,
      estado: data.estado_revision,
      comentario: data.comentario_revision,
      trimestre: data.trimestre,
      anio: data.anio,
      tipo: data.tipo,
      mensaje: `Tu trimestre fue ${data.estado_revision}`
    })

    res.json(data)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error revisando trimestre" })
  }
}