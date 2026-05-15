const pool = require("../../../database/postgres")

const CAMPOS = [
  "dependency_id","nombre_indicador","definicion","proposito","formula",
  "eje","tema","politica_publica","objetivo","estrategia",
  "anio","tipo_evaluacion","periodicidad","tipo_indicador","informe_gobierno",
  "anio_base","valor_anio_base","valor_minimo","valor_inicial","avance_anual",
  "meta_anual","meta_trianual","producto","analisis_cualitativo","unidad_medida",
  "medios_verificacion","supuestos","responsable","correo_electronico","telefono",
  "criterio_claro","criterio_relevante","criterio_economico","criterio_monitoreable",
  "criterio_adecuado","criterio_aportacion","calendarizacion","creado_por"
]

const CAMPOS_HIST = [
  "dependency_id","nombre_indicador","definicion","proposito","formula",
  "eje","tema","politica_publica","objetivo","estrategia",
  "anio","tipo_evaluacion","periodicidad","tipo_indicador","informe_gobierno",
  "anio_base","valor_anio_base","valor_minimo","valor_inicial","avance_anual",
  "meta_anual","meta_trianual","producto","analisis_cualitativo","unidad_medida",
  "medios_verificacion","supuestos","responsable","correo_electronico","telefono",
  "criterio_claro","criterio_relevante","criterio_economico","criterio_monitoreable",
  "criterio_adecuado","criterio_aportacion","calendarizacion"
]

exports.crear = async (req, res) => {
  try {
    const vals = CAMPOS.map(c => req.body[c] ?? null)
    const cols = CAMPOS.join(",")
    const params = CAMPOS.map((_,i) => `$${i+1}`).join(",")
    const result = await pool.query(
      `INSERT INTO fichas_tecnicas (${cols}) VALUES (${params}) RETURNING *`, vals
    )
    req.app.get("io").to("planeacion").emit("nueva_ficha", result.rows[0])
    res.json(result.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: "Error creando ficha" }) }
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
  } catch(e) { console.error(e); res.status(500).json({ error: "Error" }) }
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
  } catch(e) { console.error(e); res.status(500).json({ error: "Error" }) }
}

exports.actualizar = async (req, res) => {
  try {
    const { id } = req.params
    const { comentario_cambio, modificado_por } = req.body

    // 1. Guarda versión actual en historial ANTES de actualizar
    const actual = await pool.query(`SELECT * FROM fichas_tecnicas WHERE id = $1`, [id])
    if (actual.rows.length > 0) {
      const ficha = actual.rows[0]

      // Obtiene la última versión
      const ultVer = await pool.query(
        `SELECT COALESCE(MAX(version),0) as max_ver FROM fichas_tecnicas_historial WHERE ficha_id = $1`, [id]
      )
      const nextVersion = Number(ultVer.rows[0].max_ver) + 1

      const histCols = ["ficha_id","version","modificado_por","comentario_cambio", ...CAMPOS_HIST]
      const histVals = [
        id, nextVersion,
        modificado_por || null,
        comentario_cambio || null,
        ...CAMPOS_HIST.map(c => ficha[c] ?? null)
      ]
      const histParams = histVals.map((_,i) => `$${i+1}`).join(",")
      await pool.query(
        `INSERT INTO fichas_tecnicas_historial (${histCols.join(",")}) VALUES (${histParams})`,
        histVals
      )
    }

    // 2. Actualiza la ficha actual
    const campos = CAMPOS.filter(c => c !== "creado_por")
    const vals = campos.map(c => req.body[c] ?? null)
    const sets = campos.map((c,i) => `${c}=$${i+1}`).join(",")
    vals.push(id)
    const result = await pool.query(
      `UPDATE fichas_tecnicas SET ${sets} WHERE id=$${vals.length} RETURNING *`, vals
    )
    res.json(result.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: "Error actualizando" }) }
}

exports.eliminar = async (req, res) => {
  try {
    await pool.query(`DELETE FROM fichas_tecnicas WHERE id=$1`, [req.params.id])
    res.json({ ok: true })
  } catch(e) { console.error(e); res.status(500).json({ error: "Error eliminando" }) }
}

exports.historial = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.*, d.name as dependencia_nombre
      FROM fichas_tecnicas_historial h
      LEFT JOIN dependencies d ON d.id = h.dependency_id
      WHERE h.ficha_id = $1
      ORDER BY h.version DESC
    `, [req.params.ficha_id])
    res.json(result.rows)
  } catch(e) { console.error(e); res.status(500).json({ error: "Error obteniendo historial" }) }
}

exports.estrategiasPorDependencia = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT p.strategy_id, p.pmd_eje as eje, p.pmd_tema as tema,
        p.pmd_politica_publica as politica_publica, p.pmd_objetivo as objetivo,
        p.pmd_estrategia as estrategia, s.name as strategy_name
      FROM planning_templates p
      LEFT JOIN strategies s ON s.id = p.strategy_id
      WHERE p.dependency_id=$1 AND p.pmd_estrategia IS NOT NULL
      ORDER BY p.pmd_eje, p.pmd_estrategia
    `, [req.params.dependency_id])
    res.json(result.rows)
  } catch(e) { console.error(e); res.status(500).json({ error: "Error" }) }
}