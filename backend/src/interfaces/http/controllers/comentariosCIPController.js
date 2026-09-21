const pool = require("../../../database/postgres")

const ROLES_PERMITIDOS = ["inversion_publica", "planeacion_estrategica", "admin"]

const SECCIONES = {
  antecedentes:              "Antecedentes",
  situacion_sin_proyecto:    "Situación sin proyecto",
  situacion_con_proyecto:    "Situación con proyecto",
  descripcion_presupuesto:   "Descripción del presupuesto",
  objetivos_beneficios:      "Objetivos y beneficios",
  consideraciones_diagnostico: "Consideraciones del diagnóstico",
  desglose:                  "Desglose presupuestal",
  metas:                     "Metas trimestrales",
  poblacion:                 "Población objetivo",
  general:                   "Comentario general"
}

const PRIORIDADES = {
  critico:     { color:"#dc2626", bg:"#fee2e2", label:"Crítico"    },
  importante:  { color:"#d97706", bg:"#fef3c7", label:"Importante" },
  normal:      { color:"#1e40af", bg:"#dbeafe",  label:"Normal"     },
  informativo: { color:"#16a34a", bg:"#d1fae5",  label:"Informativo"},
}

const verificarAcceso = (rol) => ROLES_PERMITIDOS.includes(rol)


exports.listar = async (req, res) => {
  try {
    const { proyecto_id } = req.params
    const rol = req.usuario?.rol_nombre

    if (!verificarAcceso(rol)) {
      return res.status(403).json({ error: "Acceso denegado" })
    }

    const { seccion, estado, prioridad } = req.query
    let where   = "WHERE proyecto_id = $1"
    const params = [proyecto_id]

    if (seccion) {
      params.push(seccion)
      where += ` AND seccion = $${params.length}`
    }
    if (estado) {
      params.push(estado)
      where += ` AND estado = $${params.length}`
    }
    if (prioridad) {
      params.push(prioridad)
      where += ` AND prioridad = $${params.length}`
    }

    const r = await pool.query(`
      SELECT * FROM cip_comentarios_revision
      ${where}
      ORDER BY
        CASE prioridad
          WHEN 'critico'     THEN 1
          WHEN 'importante'  THEN 2
          WHEN 'normal'      THEN 3
          WHEN 'informativo' THEN 4
        END,
        created_at DESC
    `, params)

    const resumen = await pool.query(`
      SELECT
        seccion,
        COUNT(*)::int                                     AS total,
        COUNT(*) FILTER (WHERE estado='abierto')::int     AS abiertos,
        COUNT(*) FILTER (WHERE estado='atendido')::int    AS atendidos,
        COUNT(*) FILTER (WHERE prioridad='critico')::int  AS criticos
      FROM cip_comentarios_revision
      WHERE proyecto_id = $1
      GROUP BY seccion
    `, [proyecto_id])

    res.json({
      comentarios: r.rows.map(c => ({
        ...c,
        seccion_label:    SECCIONES[c.seccion] || c.seccion,
        prioridad_info:   PRIORIDADES[c.prioridad] || PRIORIDADES.normal,
      })),
      resumen_por_seccion: resumen.rows,
      secciones_disponibles: SECCIONES,
      prioridades_disponibles: PRIORIDADES,
      total: r.rows.length
    })
  } catch(e) {
    console.error("Error listando comentarios:", e)
    res.status(500).json({ error: e.message })
  }
}


exports.agregar = async (req, res) => {
  try {
    const { proyecto_id } = req.params
    const rol = req.usuario?.rol_nombre

    if (!verificarAcceso(rol)) {
      return res.status(403).json({ error: "Acceso denegado" })
    }

    const { seccion, comentario, prioridad = "normal" } = req.body

    if (!seccion || !comentario?.trim()) {
      return res.status(400).json({ error: "Sección y comentario son obligatorios" })
    }
    if (!SECCIONES[seccion]) {
      return res.status(400).json({ error: `Sección inválida. Opciones: ${Object.keys(SECCIONES).join(", ")}` })
    }
    if (!PRIORIDADES[prioridad]) {
      return res.status(400).json({ error: "Prioridad inválida" })
    }

    const proy = await pool.query(
      `SELECT id, nombre_proyecto, dependency_id FROM cip_proyectos WHERE id=$1`,
      [proyecto_id]
    )
    if (!proy.rows[0]) return res.status(404).json({ error: "Proyecto no encontrado" })

    const r = await pool.query(`
      INSERT INTO cip_comentarios_revision (
        proyecto_id, seccion, comentario, prioridad,
        autor_id, autor_nombre, autor_rol
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `, [
      proyecto_id,
      seccion,
      comentario.trim(),
      prioridad,
      req.usuario?.id || null,
      req.usuario?.name || "Sistema",
      rol
    ])

    const nuevo = {
      ...r.rows[0],
      seccion_label:  SECCIONES[r.rows[0].seccion],
      prioridad_info: PRIORIDADES[r.rows[0].prioridad]
    }

    req.app.get("io").emit("cip_nuevo_comentario", {
      proyecto_id,
      comentario: nuevo,
      nombre_proyecto: proy.rows[0].nombre_proyecto
    })

    res.json(nuevo)
  } catch(e) {
    console.error("Error agregando comentario:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.editar = async (req, res) => {
  try {
    const { id } = req.params
    const rol    = req.usuario?.rol_nombre

    if (!verificarAcceso(rol)) {
      return res.status(403).json({ error: "Acceso denegado" })
    }

    const actual = await pool.query(
      `SELECT * FROM cip_comentarios_revision WHERE id=$1`, [id]
    )
    if (!actual.rows[0]) return res.status(404).json({ error: "Comentario no encontrado" })

    // Solo el autor o admin puede editar
    const esAutor = actual.rows[0].autor_id === req.usuario?.id
    const esAdmin  = rol === "admin"
    if (!esAutor && !esAdmin) {
      return res.status(403).json({ error: "Solo el autor puede editar este comentario" })
    }

    const { comentario, prioridad, estado } = req.body

    const r = await pool.query(`
      UPDATE cip_comentarios_revision
      SET
        comentario = COALESCE($1, comentario),
        prioridad  = COALESCE($2, prioridad),
        estado     = COALESCE($3, estado),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [
      comentario?.trim() || null,
      prioridad || null,
      estado    || null,
      id
    ])

    res.json({
      ...r.rows[0],
      seccion_label:  SECCIONES[r.rows[0].seccion],
      prioridad_info: PRIORIDADES[r.rows[0].prioridad]
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
}


exports.responder = async (req, res) => {
  try {
    const { id } = req.params
    const rol    = req.usuario?.rol_nombre

    if (!verificarAcceso(rol)) {
      return res.status(403).json({ error: "Acceso denegado" })
    }

    const { respuesta } = req.body
    if (!respuesta?.trim()) {
      return res.status(400).json({ error: "La respuesta no puede estar vacía" })
    }

    const r = await pool.query(`
      UPDATE cip_comentarios_revision
      SET
        respuesta      = $1,
        respondido_por = $2,
        respondido_at  = NOW(),
        estado         = 'atendido',
        updated_at     = NOW()
      WHERE id = $3
      RETURNING *
    `, [respuesta.trim(), req.usuario?.name || "Sistema", id])

    if (!r.rows[0]) return res.status(404).json({ error: "Comentario no encontrado" })

    req.app.get("io").emit("cip_comentario_respondido", r.rows[0])

    res.json({
      ...r.rows[0],
      seccion_label:  SECCIONES[r.rows[0].seccion],
      prioridad_info: PRIORIDADES[r.rows[0].prioridad]
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
}


exports.cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params
    const { estado } = req.body
    const rol = req.usuario?.rol_nombre

    if (!verificarAcceso(rol)) return res.status(403).json({ error: "Acceso denegado" })

    const estadosValidos = ["abierto","atendido","descartado"]
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: `Estado inválido. Opciones: ${estadosValidos.join(", ")}` })
    }

    const r = await pool.query(`
      UPDATE cip_comentarios_revision
      SET estado=$1, updated_at=NOW()
      WHERE id=$2 RETURNING *
    `, [estado, id])

    if (!r.rows[0]) return res.status(404).json({ error: "No encontrado" })
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.eliminar = async (req, res) => {
  try {
    const { id } = req.params
    const rol    = req.usuario?.rol_nombre

    if (!verificarAcceso(rol)) return res.status(403).json({ error: "Acceso denegado" })

    const actual = await pool.query(
      `SELECT autor_id FROM cip_comentarios_revision WHERE id=$1`, [id]
    )
    if (!actual.rows[0]) return res.status(404).json({ error: "No encontrado" })

    const esAutor = actual.rows[0].autor_id === req.usuario?.id
    if (!esAutor && rol !== "admin") {
      return res.status(403).json({ error: "Solo el autor puede eliminar este comentario" })
    }

    await pool.query(`DELETE FROM cip_comentarios_revision WHERE id=$1`, [id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
}


exports.resumenGlobal = async (req, res) => {
  try {
    const rol = req.usuario?.rol_nombre
    if (!verificarAcceso(rol)) return res.status(403).json({ error: "Acceso denegado" })

    const r = await pool.query(`
      SELECT
        COUNT(*)::int                                       AS total,
        COUNT(*) FILTER (WHERE estado='abierto')::int       AS abiertos,
        COUNT(*) FILTER (WHERE estado='atendido')::int      AS atendidos,
        COUNT(*) FILTER (WHERE estado='descartado')::int    AS descartados,
        COUNT(*) FILTER (WHERE prioridad='critico')::int    AS criticos,
        COUNT(*) FILTER (WHERE prioridad='importante')::int AS importantes,
        COUNT(DISTINCT proyecto_id)::int                    AS proyectos_con_comentarios
      FROM cip_comentarios_revision
    `)

    const porProyecto = await pool.query(`
      SELECT
        v.proyecto_id,
        v.nombre_proyecto,
        v.dependencia_nombre,
        COUNT(*)::int                                      AS total_comentarios,
        COUNT(*) FILTER (WHERE v.estado='abierto')::int    AS abiertos,
        COUNT(*) FILTER (WHERE v.prioridad='critico')::int AS criticos
      FROM v_cip_comentarios v
      GROUP BY v.proyecto_id, v.nombre_proyecto, v.dependencia_nombre
      ORDER BY abiertos DESC, criticos DESC
      LIMIT 10
    `)

    res.json({
      stats:        r.rows[0],
      por_proyecto: porProyecto.rows,
      secciones:    SECCIONES,
      prioridades:  PRIORIDADES
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
}