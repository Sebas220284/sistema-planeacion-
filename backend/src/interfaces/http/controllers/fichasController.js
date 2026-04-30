const pool = require("../../../database/postgres")

exports.crear = async (req, res) => {
  try {
    const {
      dependency_id, nombre_indicador, eje, tema, politica_publica,
      objetivo, estrategia, anio, valor_inicial, avance_anual,
      meta_anual, meta_trianual, analisis_cualitativo,
      unidad_medida, medios_verificacion, supuestos, creado_por
    } = req.body

    const result = await pool.query(`
      INSERT INTO fichas_tecnicas (
        dependency_id, nombre_indicador, eje, tema, politica_publica,
        objetivo, estrategia, anio, valor_inicial, avance_anual,
        meta_anual, meta_trianual, analisis_cualitativo,
        unidad_medida, medios_verificacion, supuestos, creado_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *
    `, [
      dependency_id, nombre_indicador, eje, tema, politica_publica,
      objetivo, estrategia, anio, valor_inicial, avance_anual,
      meta_anual, meta_trianual, analisis_cualitativo,
      unidad_medida, medios_verificacion, supuestos, creado_por || null
    ])

    req.app.get("io").to("planeacion").emit("nueva_ficha", result.rows[0])
    res.json(result.rows[0])
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error creando ficha técnica" })
  }
}

exports.lista = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, d.name as dependencia_nombre, d.titular, d.enlace
      FROM fichas_tecnicas f
      LEFT JOIN dependencies d ON d.id = f.dependency_id
      ORDER BY f.created_at DESC
    `)
    res.json(result.rows)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error obteniendo fichas" })
  }
}

exports.porDependencia = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, d.name as dependencia_nombre, d.titular, d.enlace
      FROM fichas_tecnicas f
      LEFT JOIN dependencies d ON d.id = f.dependency_id
      WHERE f.dependency_id = $1
      ORDER BY f.anio DESC, f.created_at DESC
    `, [req.params.dependency_id])
    res.json(result.rows)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error obteniendo fichas" })
  }
}

exports.actualizar = async (req, res) => {
  try {
    const {
      nombre_indicador, eje, tema, politica_publica, objetivo, estrategia,
      anio, valor_inicial, avance_anual, meta_anual, meta_trianual,
      analisis_cualitativo, unidad_medida, medios_verificacion, supuestos
    } = req.body

    const result = await pool.query(`
      UPDATE fichas_tecnicas SET
        nombre_indicador=$1, eje=$2, tema=$3, politica_publica=$4,
        objetivo=$5, estrategia=$6, anio=$7, valor_inicial=$8,
        avance_anual=$9, meta_anual=$10, meta_trianual=$11,
        analisis_cualitativo=$12, unidad_medida=$13,
        medios_verificacion=$14, supuestos=$15
      WHERE id=$16
      RETURNING *
    `, [
      nombre_indicador, eje, tema, politica_publica, objetivo, estrategia,
      anio, valor_inicial, avance_anual, meta_anual, meta_trianual,
      analisis_cualitativo, unidad_medida, medios_verificacion, supuestos,
      req.params.id
    ])
    res.json(result.rows[0])
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error actualizando ficha" })
  }
}

exports.eliminar = async (req, res) => {
  try {
    await pool.query(`DELETE FROM fichas_tecnicas WHERE id = $1`, [req.params.id])
    res.json({ ok: true })
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error eliminando ficha" })
  }
}