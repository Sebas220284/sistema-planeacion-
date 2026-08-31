// interfaces/http/controllers/mppController.js
const pool = require("../../../database/postgres")

const FORMATO_TABLA = {
  3:  { tabla: "mpp_f3_arbol_problemas",    nombre: "Árbol de Problemas" },
  4:  { tabla: "mpp_f4_arbol_objetivos",    nombre: "Árbol de Objetivos" },
  5:  { tabla: "mpp_f5_alternativas",       nombre: "Selección de Alternativas" },
  6:  { tabla: "mpp_f6_arbol_alternativas", nombre: "Árbol de Alternativas" },
  7:  { tabla: "mpp_f7_eap",               nombre: "Estructura Analítica del Programa" },
  8:  { tabla: "mpp_f8_poblacion",          nombre: "Análisis de Población Objetivo" },
  9:  { tabla: "mpp_f9_intervencion",       nombre: "Caracterización de la Intervención" },
  10: { tabla: "mpp_f10_cremaa",            nombre: "Indicadores CREMAA" },
  11: { tabla: "mpp_f11_mir",              nombre: "Matriz MIR" },
}

exports.listar = async (req, res) => {
  const { dependency_id, ejercicio = 2026 } = req.query
  if (!dependency_id) return res.status(400).json({ error: "dependency_id requerido" })
  try {
    const { rows } = await pool.query(
      `SELECT d.*, dep.name as dependencia_nombre
       FROM public.mpp_documentos d
       JOIN public.dependencies dep ON dep.id = d.dependency_id
       WHERE d.dependency_id = $1 AND d.ejercicio = $2
       ORDER BY d.formato_num`,
      [dependency_id, ejercicio]
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

exports.listarTodos = async (req, res) => {
  const { ejercicio = 2026, estado, formato_num } = req.query
  try {
    let q = `SELECT d.*, dep.name as dependencia_nombre
             FROM public.mpp_documentos d
             JOIN public.dependencies dep ON dep.id = d.dependency_id
             WHERE d.ejercicio = $1`
    const params = [ejercicio]
    if (estado)      { params.push(estado);      q += ` AND d.estado = $${params.length}` }
    if (formato_num) { params.push(formato_num); q += ` AND d.formato_num = $${params.length}` }
    q += " ORDER BY dep.name, d.formato_num"
    const { rows } = await pool.query(q, params)
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

exports.obtener = async (req, res) => {
  const { id } = req.params
  try {
    const { rows: [doc] } = await pool.query(
      `SELECT d.*, dep.name as dependencia_nombre
       FROM public.mpp_documentos d
       JOIN public.dependencies dep ON dep.id = d.dependency_id
       WHERE d.id = $1`, [id]
    )
    if (!doc) return res.status(404).json({ error: "No encontrado" })
    const info = FORMATO_TABLA[doc.formato_num]
    if (info) {
      const { rows: [det] } = await pool.query(
        `SELECT * FROM public.${info.tabla} WHERE documento_id = $1`, [id]
      )
      doc.detalle = det || null
    }
    res.json(doc)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

exports.guardarMaestro = async (req, res) => {
  const {
    id, dependency_id, ejercicio = 2026, formato_num,
    programa_presupuestario, dependencia_responsable,
    unidad_administrativa, modalidad_presupuestaria, fecha_formato,
    elaboro_nombre, elaboro_cargo, elaboro_firma, elaboro_fecha, creado_por
  } = req.body

  if (!dependency_id || !formato_num)
    return res.status(400).json({ error: "dependency_id y formato_num son requeridos" })

  const info = FORMATO_TABLA[Number(formato_num)]
  if (!info) return res.status(400).json({ error: `Formato ${formato_num} no válido (3-11)` })

  try {
    let doc
    if (id) {
      const { rows } = await pool.query(
        `UPDATE public.mpp_documentos SET
           programa_presupuestario=$1, dependencia_responsable=$2,
           unidad_administrativa=$3, modalidad_presupuestaria=$4,
           fecha_formato=$5, elaboro_nombre=$6, elaboro_cargo=$7,
           elaboro_firma=$8, elaboro_fecha=$9, formato_nombre=$10
         WHERE id=$11 RETURNING *`,
        [programa_presupuestario, dependencia_responsable,
         unidad_administrativa, modalidad_presupuestaria, fecha_formato,
         elaboro_nombre, elaboro_cargo, elaboro_firma, elaboro_fecha,
         info.nombre, id]
      )
      doc = rows[0]
    } else {
      const { rows } = await pool.query(
        `INSERT INTO public.mpp_documentos
           (dependency_id, ejercicio, formato_num, formato_nombre,
            programa_presupuestario, dependencia_responsable,
            unidad_administrativa, modalidad_presupuestaria, fecha_formato,
            elaboro_nombre, elaboro_cargo, elaboro_firma, elaboro_fecha, creado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (dependency_id, ejercicio, formato_num)
         DO UPDATE SET
           programa_presupuestario = EXCLUDED.programa_presupuestario,
           dependencia_responsable  = EXCLUDED.dependencia_responsable,
           unidad_administrativa    = EXCLUDED.unidad_administrativa,
           modalidad_presupuestaria = EXCLUDED.modalidad_presupuestaria,
           elaboro_nombre           = EXCLUDED.elaboro_nombre,
           elaboro_cargo            = EXCLUDED.elaboro_cargo
         RETURNING *`,
        [dependency_id, ejercicio, Number(formato_num), info.nombre,
         programa_presupuestario, dependencia_responsable,
         unidad_administrativa, modalidad_presupuestaria, fecha_formato,
         elaboro_nombre, elaboro_cargo, elaboro_firma, elaboro_fecha, creado_por]
      )
      doc = rows[0]
    }
    res.json(doc)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

exports.guardarDetalle = async (req, res) => {
  const { documento_id } = req.params
  const campos = req.body
  try {
    const { rows: [doc] } = await pool.query(
      "SELECT formato_num FROM public.mpp_documentos WHERE id=$1", [documento_id]
    )
    if (!doc) return res.status(404).json({ error: "Documento no encontrado" })

    const info = FORMATO_TABLA[doc.formato_num]
    const tabla = `public.${info.tabla}`

    const { rows: [existente] } = await pool.query(
      `SELECT id FROM ${tabla} WHERE documento_id=$1`, [documento_id]
    )

    const keys = Object.keys(campos).filter(k => k !== "id" && k !== "documento_id")
    if (!keys.length) return res.status(400).json({ error: "Sin campos que guardar" })

    let result
    if (existente) {
      const sets = keys.map((k, i) => `"${k}"=$${i + 2}`).join(", ")
      const vals = [documento_id, ...keys.map(k => campos[k])]
      const { rows } = await pool.query(
        `UPDATE ${tabla} SET ${sets} WHERE documento_id=$1 RETURNING *`, vals
      )
      result = rows[0]
    } else {
      const cols = ["documento_id", ...keys].map(k => `"${k}"`).join(", ")
      const phs  = [documento_id, ...keys.map(k => campos[k])]
      const nums = phs.map((_, i) => `$${i + 1}`).join(", ")
      const { rows } = await pool.query(
        `INSERT INTO ${tabla} (${cols}) VALUES (${nums}) RETURNING *`, phs
      )
      result = rows[0]
    }
    res.json(result)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

exports.cambiarEstado = async (req, res) => {
  const { id } = req.params
  const { estado, comentario_revision, revisado_por } = req.body
  if (!["borrador","enviado","aprobado","rechazado"].includes(estado))
    return res.status(400).json({ error: "Estado no válido" })
  try {
    const { rows } = await pool.query(
      `UPDATE public.mpp_documentos SET
         estado=$1, comentario_revision=$2, revisado_por=$3,
         fecha_envio    = CASE WHEN $1='enviado'                   THEN now() ELSE fecha_envio    END,
         fecha_revision = CASE WHEN $1 IN ('aprobado','rechazado') THEN now() ELSE fecha_revision END
       WHERE id=$4 RETURNING *`,
      [estado, comentario_revision, revisado_por, id]
    )
    res.json(rows[0])
  } catch (e) { res.status(500).json({ error: e.message }) }
}

exports.eliminar = async (req, res) => {
  const { id } = req.params
  try {
    await pool.query("DELETE FROM public.mpp_documentos WHERE id=$1", [id])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
}

exports.exportar = async (req, res) => {
  const { id } = req.params
  try {
    const { rows: [doc] } = await pool.query(
      `SELECT d.*, dep.name as dependencia_nombre
       FROM public.mpp_documentos d
       JOIN public.dependencies dep ON dep.id = d.dependency_id
       WHERE d.id = $1`, [id]
    )
    if (!doc) return res.status(404).json({ error: "No encontrado" })
    const info = FORMATO_TABLA[doc.formato_num]
    if (info) {
      const { rows: [det] } = await pool.query(
        `SELECT * FROM public.${info.tabla} WHERE documento_id=$1`, [id]
      )
      doc.detalle = det || {}
    }
    res.json(doc)
  } catch (e) { res.status(500).json({ error: e.message }) }
}

exports.dashboard = async (req, res) => {
  const { ejercicio = 2026 } = req.query
  try {
    const { rows } = await pool.query(
      `SELECT dep.name as dependencia,
              COUNT(*)::int as total,
              COUNT(*) FILTER (WHERE d.estado='aprobado')::int  as aprobados,
              COUNT(*) FILTER (WHERE d.estado='enviado')::int   as enviados,
              COUNT(*) FILTER (WHERE d.estado='borrador')::int  as borradores,
              COUNT(*) FILTER (WHERE d.estado='rechazado')::int as rechazados
       FROM public.mpp_documentos d
       JOIN public.dependencies dep ON dep.id = d.dependency_id
       WHERE d.ejercicio = $1
       GROUP BY dep.name ORDER BY dep.name`,
      [ejercicio]
    )
    res.json(rows)
  } catch (e) { res.status(500).json({ error: e.message }) }
}