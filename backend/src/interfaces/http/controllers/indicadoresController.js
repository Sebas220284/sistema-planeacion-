const pool = require("../../../database/postgres")

exports.listar = async (req, res) => {
  try {
    const soloPend = req.query.pendientes === "1"
    const r = await pool.query(`
      SELECT strategy_id, estrategia, clave, indicador, requiere_revision, nota
      FROM v_estrategia_indicador
      ${soloPend ? "WHERE requiere_revision = TRUE OR indicador IS NULL" : ""}
      ORDER BY string_to_array(clave, '.')::int[]
    `)
    res.json(r.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Error al listar indicadores" })
  }
}

exports.porEstrategia = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT strategy_id, estrategia, clave, indicador, requiere_revision
      FROM v_estrategia_indicador
      WHERE strategy_id = $1
    `, [req.params.strategy_id])
    if (!r.rows[0]) return res.status(404).json({ error: "Estrategia no encontrada" })
    res.json(r.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Error al obtener indicador" })
  }
}

exports.actualizar = async (req, res) => {
  try {
    const indicador = (req.body.indicador || "").trim()
    if (!indicador) return res.status(400).json({ error: "El indicador no puede ir vacío" })

    const r = await pool.query(`
      UPDATE estrategia_indicadores
      SET indicador = $1, requiere_revision = FALSE, nota = NULL, updated_at = NOW()
      WHERE clave = $2
      RETURNING clave, indicador, requiere_revision
    `, [indicador, req.params.clave])

    if (!r.rows[0]) return res.status(404).json({ error: "Clave no encontrada" })
    res.json(r.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Error al actualizar indicador" })
  }
}