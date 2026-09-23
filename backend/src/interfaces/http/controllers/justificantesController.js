const pool = require("../../../database/postgres")

const MAX_BYTES = 10 * 1024 * 1024  
const CATEGORIAS = {
  general:    { label:"General"},
  avance:     { label:"Avance trimestral"},
  cierre:     { label:"Cierre de ejercicio"},
  evidencia:  { label:"Evidencia",},
  solicitud:  { label:"Solicitud",},
  otro:       { label:"Otro",},
}

const ESTADOS = {
  pendiente:  { color:"#d97706", bg:"#fef3c7",  label:"Pendiente"  },
  revisado:   { color:"#1e40af", bg:"#dbeafe", label:"Revisado"   },
  observado:  { color:"#dc2626", bg:"#fee2e2",  label:"Observado"  },
  aceptado:   { color:"#16a34a", bg:"#d1fae5", label:"Aceptado"   },
}

exports.subir = async (req, res) => {
  try {
    const {
      titulo, descripcion, categoria = "general",
      archivo_base64, archivo_nombre, archivo_tamano,
      anio, trimestre,
      subido_por, subido_por_nombre
    } = req.body

    if (!titulo?.trim())    return res.status(400).json({ error: "El título es obligatorio" })
    if (!archivo_base64)    return res.status(400).json({ error: "No se recibió ningún archivo" })
    if (!archivo_nombre)    return res.status(400).json({ error: "Nombre de archivo requerido" })

    const nombre = archivo_nombre.toLowerCase()
    if (!nombre.endsWith(".pdf")) {
      return res.status(400).json({ error: "Solo se permiten archivos PDF" })
    }

    const tamano = archivo_tamano
      ? Number(archivo_tamano)
      : Math.round((archivo_base64.length * 3) / 4)

    if (tamano > MAX_BYTES) {
      return res.status(400).json({
        error: `El archivo excede el límite de 10 MB (tamaño: ${(tamano/1024/1024).toFixed(2)} MB)`
      })
    }

    if (!CATEGORIAS[categoria]) {
      return res.status(400).json({
        error: `Categoría inválida. Opciones: ${Object.keys(CATEGORIAS).join(", ")}`
      })
    }

    const dependency_id = req.body.dependency_id || req.usuario?.dependency_id
    if (!dependency_id) return res.status(400).json({ error: "dependency_id requerido" })

    const r = await pool.query(`
      INSERT INTO dep_justificantes (
        dependency_id, titulo, descripcion, categoria,
        archivo_base64, archivo_nombre, archivo_tamano, archivo_tipo,
        anio, trimestre,
        subido_por, subido_por_nombre
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,'application/pdf',$8,$9,$10,$11)
      RETURNING id, dependency_id, titulo, descripcion, categoria,
        archivo_nombre, archivo_tamano, anio, trimestre,
        estado, subido_por_nombre, created_at
    `, [
      dependency_id,
      titulo.trim(),
      descripcion?.trim() || null,
      categoria,
      archivo_base64,
      archivo_nombre,
      tamano,
      anio     || new Date().getFullYear(),
      trimestre ? Number(trimestre) : null,
      subido_por || req.usuario?.id || null,
      subido_por_nombre || req.usuario?.name || null
    ])

    req.app.get("io").to("planeacion").emit("nuevo_justificante", {
      ...r.rows[0],
      estado_info: ESTADOS.pendiente
    })

    res.json(r.rows[0])
  } catch(e) {
    console.error("Error subiendo justificante:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.listarMios = async (req, res) => {
  try {
    const { dependency_id } = req.params
    const { anio, trimestre, estado, categoria } = req.query

    let where   = "WHERE dependency_id=$1"
    const params = [dependency_id]

    if (anio) {
      params.push(Number(anio))
      where += ` AND anio=$${params.length}`
    }
    if (trimestre) {
      params.push(Number(trimestre))
      where += ` AND trimestre=$${params.length}`
    }
    if (estado) {
      params.push(estado)
      where += ` AND estado=$${params.length}`
    }
    if (categoria) {
      params.push(categoria)
      where += ` AND categoria=$${params.length}`
    }

    const r = await pool.query(`
      SELECT id, dependency_id, titulo, descripcion, categoria,
        archivo_nombre,
        ROUND(archivo_tamano::numeric/1024, 1) AS tamano_kb,
        anio, trimestre, estado,
        comentario_revision, revisado_por_nombre, revisado_at,
        subido_por_nombre, created_at
      FROM dep_justificantes
      ${where}
      ORDER BY created_at DESC
    `, params)

    res.json({
      justificantes: r.rows.map(j => ({
        ...j,
        categoria_info: CATEGORIAS[j.categoria] || CATEGORIAS.general,
        estado_info:    ESTADOS[j.estado]        || ESTADOS.pendiente
      })),
      total:      r.rows.length,
      categorias: CATEGORIAS,
      estados:    ESTADOS
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.listarTodos = async (req, res) => {
  try {
    const { anio, trimestre, estado, categoria, dep_id } = req.query

    let where   = "WHERE 1=1"
    const params = []

    if (dep_id) {
      params.push(dep_id)
      where += ` AND j.dependency_id=$${params.length}`
    }
    if (anio) {
      params.push(Number(anio))
      where += ` AND j.anio=$${params.length}`
    }
    if (trimestre) {
      params.push(Number(trimestre))
      where += ` AND j.trimestre=$${params.length}`
    }
    if (estado) {
      params.push(estado)
      where += ` AND j.estado=$${params.length}`
    }
    if (categoria) {
      params.push(categoria)
      where += ` AND j.categoria=$${params.length}`
    }

    const r = await pool.query(`
      SELECT
        j.id, j.titulo, j.descripcion, j.categoria,
        j.archivo_nombre,
        ROUND(j.archivo_tamano::numeric/1024, 1) AS tamano_kb,
        j.anio, j.trimestre, j.estado,
        j.comentario_revision, j.revisado_por_nombre, j.revisado_at,
        j.subido_por_nombre, j.created_at,
        d.id   AS dependency_id,
        d.name AS dependencia_nombre,
        d.titular
      FROM dep_justificantes j
      JOIN dependencies d ON d.id = j.dependency_id
      ${where}
      ORDER BY
        CASE j.estado WHEN 'pendiente' THEN 1 ELSE 2 END,
        j.created_at DESC
    `, params)

    const stats = await pool.query(`
      SELECT
        COUNT(*)::int                                       AS total,
        COUNT(*) FILTER (WHERE estado='pendiente')::int    AS pendientes,
        COUNT(*) FILTER (WHERE estado='aceptado')::int     AS aceptados,
        COUNT(*) FILTER (WHERE estado='observado')::int    AS observados,
        COUNT(*) FILTER (WHERE estado='revisado')::int     AS revisados,
        COUNT(DISTINCT dependency_id)::int                  AS dependencias
      FROM dep_justificantes
    `)

    res.json({
      justificantes: r.rows.map(j => ({
        ...j,
        categoria_info: CATEGORIAS[j.categoria] || CATEGORIAS.general,
        estado_info:    ESTADOS[j.estado]        || ESTADOS.pendiente
      })),
      total:      r.rows.length,
      stats:      stats.rows[0],
      categorias: CATEGORIAS,
      estados:    ESTADOS
    })
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.descargar = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, archivo_base64, archivo_nombre, dependency_id
      FROM dep_justificantes WHERE id=$1
    `, [req.params.id])

    if (!r.rows[0]) return res.status(404).json({ error: "Justificante no encontrado" })

    const rol = req.usuario?.rol_nombre
    const esPlaneacion = ["planeacion","admin","planeacion_estrategica","inversion_publica"].includes(rol)
    const esDueno      = r.rows[0].dependency_id === req.usuario?.dependency_id

    if (!esPlaneacion && !esDueno) {
      return res.status(403).json({ error: "Acceso denegado" })
    }

    res.json({ archivo_base64: r.rows[0].archivo_base64, archivo_nombre: r.rows[0].archivo_nombre })
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.revisar = async (req, res) => {
  try {
    const { id } = req.params
    const { estado, comentario_revision } = req.body

    if (!ESTADOS[estado]) {
      return res.status(400).json({
        error: `Estado inválido. Opciones: ${Object.keys(ESTADOS).join(", ")}`
      })
    }
    if (estado === "observado" && !comentario_revision?.trim()) {
      return res.status(400).json({ error: "Escribe el motivo de la observación" })
    }

    const r = await pool.query(`
      UPDATE dep_justificantes SET
        estado              = $1,
        comentario_revision = $2,
        revisado_por        = $3,
        revisado_por_nombre = $4,
        revisado_at         = NOW(),
        updated_at          = NOW()
      WHERE id=$5
      RETURNING *
    `, [
      estado,
      comentario_revision?.trim() || null,
      req.usuario?.id   || null,
      req.usuario?.name || null,
      id
    ])

    if (!r.rows[0]) return res.status(404).json({ error: "No encontrado" })

    const dep = r.rows[0].dependency_id
    req.app.get("io").to(`room_${dep}`).emit("justificante_revisado", {
      ...r.rows[0],
      estado_info: ESTADOS[r.rows[0].estado]
    })

    res.json({ ...r.rows[0], estado_info: ESTADOS[r.rows[0].estado] })
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.eliminar = async (req, res) => {
  try {
    const actual = await pool.query(
      `SELECT dependency_id, estado FROM dep_justificantes WHERE id=$1`,
      [req.params.id]
    )
    if (!actual.rows[0]) return res.status(404).json({ error: "No encontrado" })

    const rol    = req.usuario?.rol_nombre
    const esDueno = actual.rows[0].dependency_id === req.usuario?.dependency_id
    const esAdmin  = rol === "admin"

    if (!esDueno && !esAdmin) {
      return res.status(403).json({ error: "Solo la dependencia dueña puede eliminar" })
    }
    if (actual.rows[0].estado === "aceptado") {
      return res.status(400).json({ error: "No se puede eliminar un documento ya aceptado" })
    }

    await pool.query(`DELETE FROM dep_justificantes WHERE id=$1`, [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
}