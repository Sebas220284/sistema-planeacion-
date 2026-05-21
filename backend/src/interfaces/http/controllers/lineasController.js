const pool = require("../../../database/postgres")

exports.nueva = async (req, res) => {
  try {
    const { estrategia_id, lineas_accion } = req.body

    if(!estrategia_id || !lineas_accion){
      return res.status(400).json({ error: "Faltan datos" })
    }

    const estResult = await pool.query(
      `SELECT dependency_id FROM strategies WHERE id = $1`,
      [estrategia_id]
    )

    if(!estResult.rows.length){
      return res.status(404).json({ error: "Estrategia no encontrada" })
    }

    const dependency_id = estResult.rows[0].dependency_id

    const result = await pool.query(`
      INSERT INTO planning_templates
      (strategy_id, dependency_id, lineas_accion, nomenclatura, nombre2, estado)
      VALUES($1, $2, $3, $3, $3, 'pendiente')
      RETURNING *
    `, [estrategia_id, dependency_id, lineas_accion])

    const nuevaLinea = result.rows[0]

    req.app.get("io").to("planeacion").emit("nueva_linea_pendiente", {
      ...nuevaLinea,
      mensaje: "Una dependencia propuso una nueva línea de acción"
    })

    res.json(nuevaLinea)

  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error creando línea" })
  }
}

exports.getPendientes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.lineas_accion,
        p.estado,
        p.created_at,
        d.name as dependencia,
        s.name as estrategia
      FROM planning_templates p
      LEFT JOIN strategies s ON s.id = p.strategy_id
      LEFT JOIN dependencies d ON d.id = p.dependency_id
      WHERE p.estado = 'pendiente'
      ORDER BY p.created_at DESC
    `)
    res.json(result.rows)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error obteniendo líneas pendientes" })
  }
}

exports.aprobar = async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE planning_templates
      SET estado = 'aprobado', aprobado_por = $1, fecha_revision = NOW()
      WHERE id = $2
      RETURNING *
    `, [req.body.user_id || null, req.params.id])

    const linea = result.rows[0]

    req.app.get("io").to(linea.dependency_id).emit("linea_revisada", {
      id: linea.id,
      estado: "aprobado",
      lineas_accion: linea.lineas_accion,
      mensaje: `✅ Tu línea "${linea.lineas_accion}"ha sido aprobada`
    })

    res.json(linea)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error al aprobar la linea de accion" })
  }
}

exports.rechazar = async (req, res) => {
  try {
    const { comentario, user_id } = req.body

    const result = await pool.query(`
      UPDATE planning_templates
      SET 
        estado = 'rechazado',
        comentario_planeacion = $1,
        aprobado_por = $2,
        fecha_revision = NOW()
      WHERE id = $3
      RETURNING *
    `, [comentario || "", user_id || null, req.params.id])

    const linea = result.rows[0]

    req.app.get("io").to(linea.dependency_id).emit("linea_revisada", {
      id: linea.id,
      estado: "rechazado",
      lineas_accion: linea.lineas_accion,
      comentario: comentario,
      mensaje: `❌ Tu línea "${linea.lineas_accion}" ha sido rechazada`
    })

    res.json(linea)
  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error la linea de accion ha sido rechazada" })
  }
}
  exports.eliminar = async (req, res) => {
  try {
    const { id } = req.params

    await pool.query(
      `DELETE FROM planning_trimestres WHERE planning_id = $1`,
      [id]
    )

    await pool.query(
      `DELETE FROM planning_templates WHERE id = $1`,
      [id]
    )

    req.app.get("io").emit("linea_eliminada", { id })

    res.json({ ok: true, id })

  } catch(error) {
    console.error(error)
    res.status(500).json({ error: "Error eliminando línea de accion" })
  }
}
