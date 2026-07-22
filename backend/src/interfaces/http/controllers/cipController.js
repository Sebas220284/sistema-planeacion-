const pool = require("../../../database/postgres")

const limpiar = (body) => {
  const NUMERICOS = [
    "anio","costo_total","fuente_porcentaje_1","fuente_porcentaje_2",
    "poblacion_total","poblacion_mujeres","poblacion_hombres",
    "georef_macro_lat","georef_macro_lng","georef_micro_lat","georef_micro_lng"
  ]
  const BOOLEANOS = [
    "tipo_nuevo","tipo_continuidad","tipo_ampliacion","tipo_rehabilitacion",
    "tipo_mantenimiento","tipo_construccion","tipo_equipamiento","tipo_instalacion",
    "doc_expediente_tecnico","doc_viabilidad","doc_analisis_costo",
    "doc_acreditacion_propiedad","doc_peticion_ciudadania","doc_aceptacion_comunidad",
    "doc_convenio","doc_padron_beneficiarios"
  ]
  const limpio = { ...body }
  NUMERICOS.forEach(campo => {
    const v = limpio[campo]
    if (v === "" || v === null || v === undefined) limpio[campo] = null
    else { limpio[campo] = Number(v); if (isNaN(limpio[campo])) limpio[campo] = null }
  })
  BOOLEANOS.forEach(campo => {
    const v = limpio[campo]
    limpio[campo] = (v === undefined || v === null) ? false : Boolean(v)
  })
  return limpio
}

const n = (v) => (v === "" || v === null || v === undefined) ? 0 : (Number(v) || 0)


// CATÁLOGOS
// ════════════════════════════════════════════
exports.getCatProgramas = async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM cat_programas ORDER BY clave`)
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.getCatSubprogramas = async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM cat_subprogramas WHERE clave_prog=$1 ORDER BY clave_subprog`,
      [req.params.prog]
    )
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.getCatPartidas = async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM cat_partidas ORDER BY clave`)
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.getCatFuentes = async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM cat_fuentes_financiamiento ORDER BY clave`)
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.getDependencias = async (req, res) => {
  try {
    const r = await pool.query(`SELECT id, name, titular, enlace FROM dependencies ORDER BY name`)
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.getPMDPorDependencia = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT DISTINCT
        COALESCE(p.pmd_eje,'')               AS pmd_eje,
        COALESCE(p.pmd_tema,'')              AS pmd_tema,
        COALESCE(p.pmd_politica_publica,'')  AS pmd_politica_publica,
        COALESCE(p.pmd_objetivo,'')          AS pmd_objetivo,
        COALESCE(p.pmd_estrategia,'')        AS pmd_estrategia,
        COALESCE(p.lineas_accion,'')         AS lineas_accion,
        p.strategy_id,
        s.name AS strategy_name
      FROM planning_templates p
      LEFT JOIN strategies s ON s.id = p.strategy_id
      WHERE p.dependency_id = $1
        AND (p.pmd_objetivo IS NOT NULL OR p.pmd_estrategia IS NOT NULL OR p.pmd_eje IS NOT NULL)
      ORDER BY COALESCE(p.pmd_tema,''), COALESCE(p.pmd_estrategia,'')
      LIMIT 100
    `, [req.params.dep_id])
    res.json(r.rows || [])
  } catch(e) {
    console.error("Error PMD:", e)
    res.status(500).json({ error: e.message })
  }
}
exports.getPMDPorDependencia = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT DISTINCT
        COALESCE(p.pmd_eje,'')               AS pmd_eje,
        COALESCE(p.pmd_tema,'')              AS pmd_tema,
        COALESCE(p.pmd_politica_publica,'')  AS pmd_politica_publica,
        COALESCE(p.pmd_objetivo,'')          AS pmd_objetivo,
        COALESCE(p.pmd_estrategia,'')        AS pmd_estrategia,
        COALESCE(p.lineas_accion,'')         AS lineas_accion,
        p.strategy_id,
        s.name AS strategy_name
      FROM planning_templates p
      LEFT JOIN strategies s ON s.id = p.strategy_id
      WHERE p.dependency_id = $1
        AND (p.pmd_objetivo IS NOT NULL OR p.pmd_estrategia IS NOT NULL OR p.pmd_eje IS NOT NULL)
      ORDER BY COALESCE(p.pmd_tema,''), COALESCE(p.pmd_estrategia,'')
      LIMIT 100
    `, [req.params.dep_id])
    res.json(r.rows || [])
  } catch(e) {
    console.error("Error PMD:", e)
    res.status(500).json({ error: e.message })
  }
}
exports.obtenerParaExportar = async (req, res) => {
  try {
    const [proyecto, metas, desglose] = await Promise.all([
      pool.query(`
        SELECT p.*, d.name AS dependencia_nombre, d.titular, d.enlace,
          cp.descripcion AS programa_desc,
          cs.descripcion AS subprograma_desc,
          u.name AS creado_por_nombre,
          cf1.descripcion AS fuente1_desc,
          cf2.descripcion AS fuente2_desc
        FROM cip_proyectos p
        LEFT JOIN dependencies d ON d.id = p.dependency_id
        LEFT JOIN cat_programas cp ON cp.clave = p.clave_programa
        LEFT JOIN cat_subprogramas cs ON cs.clave_prog=p.clave_programa AND cs.clave_subprog=p.clave_subprograma
        LEFT JOIN users u ON u.id = p.creado_por
        LEFT JOIN cat_fuentes_financiamiento cf1 ON cf1.clave = p.fuente_financiamiento_1
        LEFT JOIN cat_fuentes_financiamiento cf2 ON cf2.clave = p.fuente_financiamiento_2
        WHERE p.id=$1
      `, [req.params.id]),
      pool.query(`SELECT * FROM cip_metas WHERE proyecto_id=$1 ORDER BY orden`, [req.params.id]),
      pool.query(`SELECT * FROM cip_desglose_presupuesto WHERE proyecto_id=$1 ORDER BY orden`, [req.params.id]),
    ])
    if (!proyecto.rows[0]) return res.status(404).json({ error: "Proyecto no encontrado" })
    res.json({ ...proyecto.rows[0], metas: metas.rows, desglose: desglose.rows })
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }) }
}



const CAMPOS_CIP = [
  "anio","folio","clave_programa","clave_subprograma","dependency_id",
  "unidad_responsable","ods","ods_meta","ods_indicador","plan_nacional","plan_estatal","plan_municipal",
  "pmd_eje","pmd_tema","pmd_politica_publica","pmd_objetivo","pmd_estrategia",
  "pmd_lineas_accion","strategy_id","nombre_proyecto","localidad",
  "fuente_financiamiento_1","fuente_porcentaje_1",
  "fuente_financiamiento_2","fuente_porcentaje_2",
  "otra_fuente","costo_total","periodo_ejecucion",
  "tipo_nuevo","tipo_continuidad","tipo_ampliacion","tipo_rehabilitacion",
  "tipo_mantenimiento","tipo_construccion","tipo_equipamiento","tipo_instalacion","tipo_otros",
  "doc_expediente_tecnico","doc_viabilidad","doc_analisis_costo","doc_acreditacion_propiedad",
  "doc_peticion_ciudadania","doc_aceptacion_comunidad","doc_convenio",
  "doc_padron_beneficiarios","doc_otros_especifique",
  "origen_antecedentes","situacion_sin_proyecto","situacion_con_proyecto",
  "descripcion_presupuesto","objetivos_beneficios","consideraciones_diagnostico",
  "unidad_medida_poblacion","poblacion_total","poblacion_mujeres","poblacion_hombres",
  "tipo_poblacion",
  "georef_macro_lat","georef_macro_lng","georef_macro_localidad",
  "georef_micro_lat","georef_micro_lng","georef_micro_localidad",
  "elaboro_nombre","elaboro_cargo","visto_bueno_nombre","visto_bueno_cargo"
]

exports.listar = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT p.*, d.name AS dependencia_nombre,
        u.name AS creado_por_nombre,
        cp.descripcion AS programa_desc,
        COUNT(DISTINCT m.id)  AS total_metas,
        COUNT(DISTINCT f.id)  AS total_fotos,
        COALESCE(SUM(dp.importe_con_iva), 0) AS presupuesto_calculado
      FROM cip_proyectos p
      LEFT JOIN dependencies d   ON d.id   = p.dependency_id
      LEFT JOIN users u           ON u.id   = p.creado_por
      LEFT JOIN cat_programas cp  ON cp.clave = p.clave_programa
      LEFT JOIN cip_metas m       ON m.proyecto_id = p.id
      LEFT JOIN cip_fotos f       ON f.proyecto_id = p.id
      LEFT JOIN cip_desglose_presupuesto dp ON dp.proyecto_id = p.id
      GROUP BY p.id, d.name, u.name, cp.descripcion
      ORDER BY p.created_at DESC
    `)
    res.json(r.rows)
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }) }
}

exports.obtener = async (req, res) => {
  try {
    const proyecto = await pool.query(`
      SELECT p.*, d.name AS dependencia_nombre,
        cp.descripcion AS programa_desc,
        u.name AS creado_por_nombre, u.email AS creado_por_email
      FROM cip_proyectos p
      LEFT JOIN dependencies d   ON d.id   = p.dependency_id
      LEFT JOIN cat_programas cp  ON cp.clave = p.clave_programa
      LEFT JOIN users u           ON u.id   = p.creado_por
      WHERE p.id = $1
    `, [req.params.id])

    const [metas, desglose, fotos] = await Promise.all([
      pool.query(`SELECT * FROM cip_metas WHERE proyecto_id=$1 ORDER BY orden`, [req.params.id]),
      pool.query(`SELECT * FROM cip_desglose_presupuesto WHERE proyecto_id=$1 ORDER BY orden`, [req.params.id]),
      pool.query(`SELECT * FROM cip_fotos WHERE proyecto_id=$1 ORDER BY orden`, [req.params.id]),
    ])

    res.json({
      ...proyecto.rows[0],
      metas:    metas.rows,
      desglose: desglose.rows,
      fotos:    fotos.rows
    })
  } catch(e) { console.error(e); res.status(500).json({ error: e.message }) }
}

exports.crear = async (req, res) => {
  try {
    const body   = limpiar(req.body)
    const campos = [...CAMPOS_CIP, "creado_por"]
    const vals   = campos.map(c => body[c] ?? null)
    const cols   = campos.join(",")
    const params = campos.map((_, i) => `$${i + 1}`).join(",")

    const r = await pool.query(
      `INSERT INTO cip_proyectos (${cols}) VALUES (${params}) RETURNING *`,
      vals
    )
    req.app.get("io").to("planeacion").emit("nuevo_cip", r.rows[0])
    res.json(r.rows[0])
  } catch(e) {
    console.error("Error crear CIP:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.actualizar = async (req, res) => {
  try {
    const body = limpiar(req.body)
    const vals = CAMPOS_CIP.map(c => body[c] ?? null)
    const sets = CAMPOS_CIP.map((c, i) => `${c}=$${i + 1}`).join(",")
    vals.push(req.params.id)

    const r = await pool.query(
      `UPDATE cip_proyectos SET ${sets}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`,
      vals
    )
    res.json(r.rows[0])
  } catch(e) {
    console.error("Error actualizar CIP:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.eliminar = async (req, res) => {
  try {
    await pool.query(`DELETE FROM cip_proyectos WHERE id=$1`, [req.params.id])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.cambiarEstado = async (req, res) => {
  try {
    const { estado, comentario_revision, revisado_por } = req.body
    const r = await pool.query(`
      UPDATE cip_proyectos
      SET estado=$1, comentario_revision=$2, revisado_por=$3,
          fecha_revision=NOW(), updated_at=NOW()
      WHERE id=$4 RETURNING *
    `, [estado, comentario_revision || null, revisado_por || null, req.params.id])
    req.app.get("io").emit("cip_estado_cambio", r.rows[0])
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
}


exports.getDesglose = async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM cip_desglose_presupuesto WHERE proyecto_id=$1 ORDER BY orden`,
      [req.params.id]
    )
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.agregarDesglose = async (req, res) => {
  try {
    const r = await pool.query(`
      INSERT INTO cip_desglose_presupuesto
        (proyecto_id, partida_clave, partida_desc, grupo_nombre, descripcion, importe_sin_iva, tiene_iva, orden)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [
      req.params.id,
      req.body.partida_clave || null,
      req.body.partida_desc  || null,
      req.body.grupo_nombre  || null,
      req.body.descripcion   || null,
      n(req.body.importe_sin_iva),
      req.body.tiene_iva !== false,
      n(req.body.orden)
    ])
    res.json(r.rows[0])
  } catch(e) {
    console.error("Error agregar desglose:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.actualizarDesglose = async (req, res) => {
  try {
    const r = await pool.query(`
      UPDATE cip_desglose_presupuesto
      SET partida_clave=$1, partida_desc=$2, grupo_nombre=$3,
          descripcion=$4, importe_sin_iva=$5, tiene_iva=$6
      WHERE id=$7 RETURNING *
    `, [
      req.body.partida_clave || null,
      req.body.partida_desc  || null,
      req.body.grupo_nombre  || null,
      req.body.descripcion   || null,
      n(req.body.importe_sin_iva),
      req.body.tiene_iva !== false,
      req.params.did
    ])
    res.json(r.rows[0])
  } catch(e) {
    console.error("Error actualizar desglose:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.eliminarDesglose = async (req, res) => {
  try {
    await pool.query(`DELETE FROM cip_desglose_presupuesto WHERE id=$1`, [req.params.did])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
}


exports.getMetas = async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM cip_metas WHERE proyecto_id=$1 ORDER BY orden`,
     [req.params.id]
    )
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.agregarMeta = async (req, res) => {
  try {
    const r = await pool.query(`
      INSERT INTO cip_metas
        (proyecto_id, descripcion, unidad_medida, cantidad_total, t1, t2, t3, t4, orden)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
    `, [
      req.params.id,
      req.body.descripcion   || "",
      req.body.unidad_medida || "",
      n(req.body.cantidad_total),
      n(req.body.t1),
      n(req.body.t2),
      n(req.body.t3),
      n(req.body.t4),
      n(req.body.orden)
    ])
    res.json(r.rows[0])
  } catch(e) {
    console.error("Error agregar meta:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.actualizarMeta = async (req, res) => {
  try {
    const r = await pool.query(`
      UPDATE cip_metas
      SET descripcion=$1, unidad_medida=$2, cantidad_total=$3,
          t1=$4, t2=$5, t3=$6, t4=$7
      WHERE id=$8 RETURNING *
    `, [
      req.body.descripcion   || "",
      req.body.unidad_medida || "",
      n(req.body.cantidad_total),
      n(req.body.t1),
      n(req.body.t2),
      n(req.body.t3),
      n(req.body.t4),
      req.params.mid
    ])
    res.json(r.rows[0])
  } catch(e) {
    console.error("Error actualizar meta:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.eliminarMeta = async (req, res) => {
  try {
    await pool.query(`DELETE FROM cip_metas WHERE id=$1`, [req.params.mid])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
}
