const pool = require("../../../database/postgres")

exports.crear = async (req, res) => {
  try {
    const { eje, tema, politica_publica, objetivo, estrategia, creado_por } = req.body

    const result = await pool.query(`
      INSERT INTO pmd_estrategias (eje, tema, politica_publica, objetivo, estrategia, creado_por)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `, [eje, tema, politica_publica, objetivo, estrategia, creado_por || null])

    const data = result.rows[0]

    req.app.get("io").to("planeacion").emit("nuevo_plan_estrategico", {
      ...data,
      mensaje: "Nuevo plan estratégico enviado para revisión"
    })

    res.json(data)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error creando plan estratégico" })
  }
}

exports.lista = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM pmd_estrategias ORDER BY created_at DESC
    `)
    res.json(result.rows)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error obteniendo planes" })
  }
}

exports.revisar = async (req, res) => {
  try {
    const { estado, comentario, revisado_por } = req.body

    const result = await pool.query(`
      UPDATE pmd_estrategias
      SET estado = $1, comentario_revision = $2, revisado_por = $3, fecha_revision = NOW()
      WHERE id = $4
      RETURNING *
    `, [estado, comentario || "", revisado_por || null, req.params.id])

    const data = result.rows[0]

    if(estado === "aprobado"){
      await pool.query(`
        INSERT INTO strategies (id, dependency_id, name, description)
        SELECT gen_random_uuid(), NULL, $1, $2
        WHERE NOT EXISTS (
          SELECT 1 FROM strategies WHERE name = $1
        )
      `, [data.estrategia, data.objetivo])
    }

    req.app.get("io").emit("plan_revisado", data)

    res.json(data)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error revisando plan" })
  }
}
  exports.aprobados = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM pmd_estrategias 
      WHERE estado = 'aprobado'
      ORDER BY eje, tema, estrategia
    `)
    res.json(result.rows)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error obteniendo estrategias" })
  }
}