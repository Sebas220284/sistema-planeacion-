const pool = require("../../../database/postgres")
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
exports.editarDirecto = async (req, res) => {
  try {
    const { planning_id, anio, trimestre, tipo, valor, comentario } = req.body

    if (!planning_id || !anio || !trimestre || !tipo) {
      return res.status(400).json({ error: "Faltan datos obligatorios" })
    }

    const valorLimpio = (valor === "" || valor === null || valor === undefined) ? null : Number(valor)

    const r = await pool.query(`
      INSERT INTO planning_trimestres (planning_id, anio, trimestre, tipo, valor, comentario, estado_revision, estado_envio)
      VALUES ($1,$2,$3,$4,$5,$6,'aprobado','enviado')
      ON CONFLICT (planning_id, anio, trimestre, tipo)
      DO UPDATE SET valor=$5, comentario=COALESCE($6, planning_trimestres.comentario)
      RETURNING *
    `, [planning_id, anio, trimestre, tipo, valorLimpio, comentario || null])

    req.app.get("io").emit("trimestre_actualizado", r.rows[0])
    res.json(r.rows[0])
  } catch(e) {
    console.error("Error editando trimestre:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.porLineaCompleto = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT * FROM planning_trimestres WHERE planning_id=$1 ORDER BY anio, trimestre, tipo
    `, [req.params.linea_id])
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}