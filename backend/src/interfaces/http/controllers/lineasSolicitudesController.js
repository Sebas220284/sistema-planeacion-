const pool = require("../../../database/postgres")


exports.listarMias = async (req, res) => {
  try {
    const { dependency_id } = req.params
    const r = await pool.query(`
      SELECT ls.*,
        d.name  AS dependencia_nombre,
        s.name  AS strategy_nombre,
        u.name  AS revisada_por_nombre,
        u2.name AS creada_por_nombre
      FROM lineas_solicitudes ls
      LEFT JOIN dependencies d  ON d.id  = ls.dependency_id
      LEFT JOIN strategies s    ON s.id  = ls.strategy_id
      LEFT JOIN users u         ON u.id  = ls.revisada_por
      LEFT JOIN users u2        ON u2.id = ls.creada_por
      WHERE ls.dependency_id = $1
      ORDER BY ls.pmd_eje, ls.pmd_estrategia, ls.created_at DESC
    `, [dependency_id])
    res.json(r.rows)
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }) }
}

exports.crear = async (req, res) => {
  try {
    const {
      dependency_id, strategy_id,
      pmd_eje, pmd_tema, pmd_politica_publica, pmd_objetivo, pmd_estrategia,
      lineas_accion, nomenclatura, unidad_medida, responsable, justificacion,
      creada_por
    } = req.body

    if (!dependency_id || !lineas_accion?.trim()) {
      return res.status(400).json({ error: "dependency_id y lineas_accion son obligatorios" })
    }

    const r = await pool.query(`
      INSERT INTO lineas_solicitudes (
        dependency_id, strategy_id,
        pmd_eje, pmd_tema, pmd_politica_publica, pmd_objetivo, pmd_estrategia,
        lineas_accion, nomenclatura, unidad_medida, responsable, justificacion,
        creada_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      dependency_id, strategy_id || null,
      pmd_eje||null, pmd_tema||null, pmd_politica_publica||null,
      pmd_objetivo||null, pmd_estrategia||null,
      lineas_accion.trim(), nomenclatura||null, unidad_medida||null,
      responsable||null, justificacion||null, creada_por||null
    ])

    req.app.get("io").to("planeacion").emit("nueva_solicitud_linea", r.rows[0])
    res.json(r.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }) }
}

exports.actualizar = async (req, res) => {
  try {
    const { id } = req.params
    const {
      strategy_id,
      pmd_eje, pmd_tema, pmd_politica_publica, pmd_objetivo, pmd_estrategia,
      lineas_accion, nomenclatura, unidad_medida, responsable, justificacion
    } = req.body

    const check = await pool.query(
      `SELECT estado FROM lineas_solicitudes WHERE id=$1`, [id]
    )
    if (!check.rows[0]) return res.status(404).json({ error: "No encontrada" })
    if (!["borrador","rechazada"].includes(check.rows[0].estado)) {
      return res.status(400).json({ error: "Solo se puede editar en estado borrador o rechazada" })
    }

    const r = await pool.query(`
      UPDATE lineas_solicitudes SET
        strategy_id=$1, pmd_eje=$2, pmd_tema=$3, pmd_politica_publica=$4,
        pmd_objetivo=$5, pmd_estrategia=$6, lineas_accion=$7, nomenclatura=$8,
        unidad_medida=$9, responsable=$10, justificacion=$11,
        estado='borrador', comentario_rechazo=NULL, updated_at=NOW()
      WHERE id=$12 RETURNING *
    `, [
      strategy_id||null, pmd_eje||null, pmd_tema||null, pmd_politica_publica||null,
      pmd_objetivo||null, pmd_estrategia||null, lineas_accion?.trim(),
      nomenclatura||null, unidad_medida||null, responsable||null,
      justificacion||null, id
    ])
    res.json(r.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }) }
}

exports.enviar = async (req, res) => {
  try {
    const { id } = req.params
    const check = await pool.query(
      `SELECT estado, lineas_accion FROM lineas_solicitudes WHERE id=$1`, [id]
    )
    if (!check.rows[0]) return res.status(404).json({ error: "No encontrada" })
    if (!["borrador","rechazada"].includes(check.rows[0].estado)) {
      return res.status(400).json({ error: "Solo puedes enviar solicitudes en borrador o rechazadas" })
    }

    const r = await pool.query(`
      UPDATE lineas_solicitudes
      SET estado='enviada', enviada_at=NOW(), updated_at=NOW()
      WHERE id=$1 RETURNING *
    `, [id])

    req.app.get("io").to("planeacion").emit("solicitud_linea_enviada", r.rows[0])
    res.json(r.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }) }
}

exports.eliminar = async (req, res) => {
  try {
    const check = await pool.query(
      `SELECT estado FROM lineas_solicitudes WHERE id=$1`, [req.params.id]
    )
    if (!check.rows[0]) return res.status(404).json({ error: "No encontrada" })
    if (check.rows[0].estado !== "borrador") {
      return res.status(400).json({ error: "Solo se pueden eliminar borradores" })
    }
    await pool.query(`DELETE FROM lineas_solicitudes WHERE id=$1`, [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.listarTodas = async (req, res) => {
  try {
    const { estado, dependency_id, eje } = req.query
    let where = "WHERE 1=1"
    const params = []
    if (estado)        { params.push(estado);        where += ` AND ls.estado=$${params.length}` }
    if (dependency_id) { params.push(dependency_id); where += ` AND ls.dependency_id=$${params.length}` }
    if (eje)           { params.push(`%${eje}%`);    where += ` AND ls.pmd_eje ILIKE $${params.length}` }

    const r = await pool.query(`
      SELECT ls.*,
        d.name  AS dependencia_nombre,
        d.titular,
        s.name  AS strategy_nombre,
        u.name  AS revisada_por_nombre,
        u2.name AS creada_por_nombre
      FROM lineas_solicitudes ls
      LEFT JOIN dependencies d ON d.id  = ls.dependency_id
      LEFT JOIN strategies s   ON s.id  = ls.strategy_id
      LEFT JOIN users u        ON u.id  = ls.revisada_por
      LEFT JOIN users u2       ON u2.id = ls.creada_por
      ${where}
      ORDER BY
        CASE ls.estado
          WHEN 'enviada'   THEN 1
          WHEN 'aprobada'  THEN 2
          WHEN 'rechazada' THEN 3
          WHEN 'borrador'  THEN 4
        END,
        ls.pmd_eje, ls.pmd_estrategia, ls.created_at DESC
    `, params)
    res.json(r.rows)
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }) }
}

exports.aprobar = async (req, res) => {
  try {
    const { id } = req.params
    const { revisada_por } = req.body

    const r = await pool.query(`
      UPDATE lineas_solicitudes
      SET estado='aprobada', revisada_at=NOW(),
          revisada_por=$1, comentario_rechazo=NULL, updated_at=NOW()
      WHERE id=$2 AND estado='enviada'
      RETURNING *
    `, [revisada_por||null, id])

    if (!r.rows[0]) return res.status(400).json({ error: "Solo se pueden aprobar solicitudes enviadas" })

    const dep = r.rows[0].dependency_id
    req.app.get("io").to(`dep_${dep}`).emit("solicitud_linea_aprobada", r.rows[0])
    req.app.get("io").to(`room_${dep}`).emit("solicitud_linea_aprobada", r.rows[0])
    res.json(r.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }) }
}

exports.rechazar = async (req, res) => {
  try {
    const { id } = req.params
    const { revisada_por, comentario_rechazo } = req.body

    if (!comentario_rechazo?.trim()) {
      return res.status(400).json({ error: "El motivo de rechazo es obligatorio" })
    }

    const r = await pool.query(`
      UPDATE lineas_solicitudes
      SET estado='rechazada', revisada_at=NOW(),
          revisada_por=$1, comentario_rechazo=$2, updated_at=NOW()
      WHERE id=$3 AND estado='enviada'
      RETURNING *
    `, [revisada_por||null, comentario_rechazo.trim(), id])

    if (!r.rows[0]) return res.status(400).json({ error: "Solo se pueden rechazar solicitudes enviadas" })

    const dep = r.rows[0].dependency_id
    req.app.get("io").to(`dep_${dep}`).emit("solicitud_linea_rechazada", r.rows[0])
    req.app.get("io").to(`room_${dep}`).emit("solicitud_linea_rechazada", r.rows[0])
    res.json(r.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }) }
}

exports.habilitarPDF = async (req, res) => {
  try {
    const { id } = req.params
    const { habilitado_por } = req.body

    const r = await pool.query(`
      UPDATE lineas_solicitudes
      SET pdf_habilitado=TRUE, pdf_habilitado_at=NOW(),
          pdf_habilitado_por=$1, updated_at=NOW()
      WHERE id=$2 AND estado='aprobada'
      RETURNING *
    `, [habilitado_por||null, id])

    if (!r.rows[0]) return res.status(400).json({ error: "Solo se puede habilitar PDF de líneas aprobadas" })

    const dep = r.rows[0].dependency_id
    req.app.get("io").to(`dep_${dep}`).emit("pdf_linea_habilitado", r.rows[0])
    req.app.get("io").to(`room_${dep}`).emit("pdf_linea_habilitado", r.rows[0])
    res.json(r.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }) }
}

exports.pasarAlPOA = async (req, res) => {
  try {
    const { ids, pasada_por } = req.body  

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Debes enviar al menos un id" })
    }

    const resultados = []

    for (const id of ids) {
      const sol = await pool.query(
        `SELECT * FROM lineas_solicitudes WHERE id=$1 AND estado='aprobada'`, [id]
      )
      if (!sol.rows[0]) { resultados.push({ id, ok:false, error:"No encontrada o no aprobada" }); continue }
      if (sol.rows[0].pasada_al_poa) { resultados.push({ id, ok:false, error:"Ya está en el POA" }); continue }

      const s = sol.rows[0]

      const pt = await pool.query(`
        INSERT INTO planning_templates (
          dependency_id, strategy_id,
          pmd_eje, pmd_tema, pmd_politica_publica, pmd_objetivo, pmd_estrategia,
          lineas_accion, nomenclatura, unidad_medida,
          ejercicio, estado
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'activo')
        RETURNING id
      `, [
        s.dependency_id, s.strategy_id||null,
        s.pmd_eje||null, s.pmd_tema||null, s.pmd_politica_publica||null,
        s.pmd_objetivo||null, s.pmd_estrategia||null,
        s.lineas_accion, s.nomenclatura||null, s.unidad_medida||null,
        new Date().getFullYear()
      ])

      await pool.query(`
        UPDATE lineas_solicitudes
        SET pasada_al_poa=TRUE, poa_at=NOW(),
            planning_template_id=$1, updated_at=NOW()
        WHERE id=$2
      `, [pt.rows[0].id, id])

      resultados.push({ id, ok:true, planning_id: pt.rows[0].id })
    }

    res.json({ resultados, total_pasadas: resultados.filter(r=>r.ok).length })
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }) }
}

exports.getStats = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*)::int                                     AS total,
        COUNT(*) FILTER (WHERE estado='enviada')::int     AS enviadas,
        COUNT(*) FILTER (WHERE estado='aprobada')::int    AS aprobadas,
        COUNT(*) FILTER (WHERE estado='rechazada')::int   AS rechazadas,
        COUNT(*) FILTER (WHERE estado='borrador')::int    AS borradores,
        COUNT(*) FILTER (WHERE pdf_habilitado=TRUE)::int  AS con_pdf,
        COUNT(*) FILTER (WHERE pasada_al_poa=TRUE)::int   AS en_poa
      FROM lineas_solicitudes
    `)
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
}