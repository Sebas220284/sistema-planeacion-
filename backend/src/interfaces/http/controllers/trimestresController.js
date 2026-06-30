const PostgresPlanningRepository = require("../../../infrastructure/repositories/PostgresPlanningRepository")
const SaveTrimestre = require("../../../application/use-cases/SaveTrimestre")

const repository = new PostgresPlanningRepository()

exports.save = async (req, res) => {
  try {
    const useCase = new SaveTrimestre(repository)
    const data = await useCase.execute(req.body)

    if(data){ 
      req.app.get("io").to("planeacion").emit("dependencia_envio_planeacion", {
        planning_id: data.planning_id,
        fecha_envio: data.fecha_envio,
        mensaje: "Una dependencia actualizó su planeación"
      })
      req.app.get("io").emit("trimestre_actualizado", data)
    }

    res.json(data || {})
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error guardando trimestre" })
  }
}
exports.getByLinea = async (req, res) => {
  try {
    const data = await repository.getTrimestres(req.params.planning_id)
    res.json(data)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error obteniendo trimestres" })
  }
}