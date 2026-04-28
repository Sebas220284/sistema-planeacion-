const pool = require("../../../database/postgres")

exports.habilitar = async (req, res) => {
  try {
    const { dependency_id, anio, trimestre, habilitado_por } = req.body

    const result = await pool.query(`
      INSERT INTO pdf_habilitados (dependency_id, anio, trimestre, habilitado_por)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (dependency_id, anio, trimestre)
      DO UPDATE SET
        habilitado = true,
        habilitado_por = EXCLUDED.habilitado_por,
        fecha_habilitacion = NOW()
      RETURNING *
    `, [dependency_id, anio, trimestre ?? null, habilitado_por ?? null])

    const data = result.rows[0]

    req.app.get("io").to(dependency_id).emit("pdf_habilitado", {
      anio: data.anio,
      trimestre: data.trimestre,
      mensaje: trimestre
        ? `✅ Tu PDF del T${trimestre}-${anio} fue habilitado`
        : `✅ Tu PDF del año ${anio} fue habilitado`
    })

    res.json(data)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error habilitando PDF" })
  }
}

exports.getHabilitados = async (req, res) => {
  try {
    const { dependency_id } = req.params

    if (!dependency_id || dependency_id === "undefined" || dependency_id === "null") {
      return res.json([])
    }

    const result = await pool.query(`
      SELECT * FROM pdf_habilitados
      WHERE dependency_id = $1 AND habilitado = true
    `, [dependency_id])
    res.json(result.rows)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error obteniendo PDFs habilitados" })
  }
}