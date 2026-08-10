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
    "doc_convenio","doc_padron_beneficiarios","tiene_padron_beneficiarios"
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

  // Ensure poblacion_data is stringified for pg driver to insert into JSONB column
  if (limpio.poblacion_data && typeof limpio.poblacion_data !== 'string') {
    limpio.poblacion_data = JSON.stringify(limpio.poblacion_data);
  }

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
  "doc_padron_beneficiarios","tiene_padron_beneficiarios","doc_otros_especifique",
  "origen_antecedentes","situacion_sin_proyecto","situacion_con_proyecto",
  "descripcion_presupuesto","objetivos_beneficios","consideraciones_diagnostico",
  "unidad_medida_poblacion","poblacion_total","poblacion_mujeres","poblacion_hombres",
  "tipo_poblacion","poblacion_data",
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


const guardarHistorial = async (pool, proyecto_id, estado_anterior, estado_nuevo, usuario_id, usuario_nombre, comentario, pdf_habilitado) => {
  await pool.query(`
    INSERT INTO cip_historial_estados
      (proyecto_id, estado_anterior, estado_nuevo, usuario_id, usuario_nombre, comentario, pdf_habilitado)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
  `, [proyecto_id, estado_anterior||null, estado_nuevo, usuario_id||null, usuario_nombre||null, comentario||null, pdf_habilitado||null])
}

exports.enviarRevision = async (req, res) => {
  try {
    const { id } = req.params
    const { enviado_por_nombre } = req.body

    const actual = await pool.query(`SELECT estado, nombre_proyecto, dependency_id FROM cip_proyectos WHERE id=$1`, [id])
    if (!actual.rows[0]) return res.status(404).json({ error: "CIP no encontrada" })

    const { estado, nombre_proyecto, dependency_id } = actual.rows[0]
    if (!["borrador","rechazado"].includes(estado)) {
      return res.status(400).json({ error: `No se puede enviar desde el estado "${estado}"` })
    }

    const r = await pool.query(`
      UPDATE cip_proyectos
      SET estado='enviado', fecha_envio=NOW(), updated_at=NOW()
      WHERE id=$1 RETURNING *
    `, [id])

    await guardarHistorial(pool, id, estado, "enviado", null, enviado_por_nombre||"Dependencia", "Enviado a revisión de Planeación", null)

    const io = req.app.get("io")
    io.to("planeacion").emit("cip_enviado_revision", {
      ...r.rows[0],
      dependencia_nombre: r.rows[0].dependencia_nombre || "Dependencia"
    })
    io.to("inversion_publica").emit("cip_enviado_revision", r.rows[0])

    res.json(r.rows[0])
  } catch(e) {
    console.error("Error enviar CIP:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.aprobarCIP = async (req, res) => {
  try {
    const { id } = req.params
    const { revisado_por, revisado_por_nombre, comentario } = req.body

    const actual = await pool.query(`SELECT estado FROM cip_proyectos WHERE id=$1`, [id])
    if (!actual.rows[0]) return res.status(404).json({ error: "CIP no encontrada" })
    if (actual.rows[0].estado !== "enviado") {
      return res.status(400).json({ error: "Solo se pueden aprobar CIPs en estado 'enviado'" })
    }

    const r = await pool.query(`
      UPDATE cip_proyectos
      SET estado='aprobado', revisado_por=$1,
          comentario_revision=$2, fecha_revision=NOW(), updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [revisado_por||null, comentario||null, id])

    await guardarHistorial(pool, id, "enviado", "aprobado", revisado_por, revisado_por_nombre, comentario, null)

    const io = req.app.get("io")
    io.to(r.rows[0].dependency_id.toString()).emit("cip_aprobado", r.rows[0])
    io.to("planeacion").emit("cip_estado_cambio", r.rows[0])

    res.json(r.rows[0])
  } catch(e) {
    console.error("Error aprobar CIP:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.rechazarCIP = async (req, res) => {
  try {
    const { id } = req.params
    const { revisado_por, revisado_por_nombre, comentario_revision } = req.body

    if (!comentario_revision?.trim()) {
      return res.status(400).json({ error: "El motivo del rechazo es obligatorio" })
    }

    const actual = await pool.query(`SELECT estado FROM cip_proyectos WHERE id=$1`, [id])
    if (!actual.rows[0]) return res.status(404).json({ error: "CIP no encontrada" })
    if (actual.rows[0].estado !== "enviado") {
      return res.status(400).json({ error: "Solo se pueden rechazar CIPs en estado 'enviado'" })
    }

    const r = await pool.query(`
      UPDATE cip_proyectos
      SET estado='rechazado', revisado_por=$1,
          comentario_revision=$2, fecha_revision=NOW(),
          pdf_habilitado=FALSE, updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [revisado_por||null, comentario_revision.trim(), id])

    await guardarHistorial(pool, id, "enviado", "rechazado", revisado_por, revisado_por_nombre, comentario_revision, false)

    const io = req.app.get("io")
    io.to(r.rows[0].dependency_id.toString()).emit("cip_rechazado", r.rows[0])
    io.to("planeacion").emit("cip_estado_cambio", r.rows[0])

    res.json(r.rows[0])
  } catch(e) {
    console.error("Error rechazar CIP:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.togglePDF = async (req, res) => {
  try {
    const { id } = req.params
    const { habilitar, habilitado_por, habilitado_por_nombre } = req.body

    const actual = await pool.query(`SELECT estado, pdf_habilitado, nombre_proyecto FROM cip_proyectos WHERE id=$1`, [id])
    if (!actual.rows[0]) return res.status(404).json({ error: "CIP no encontrada" })

    const r = await pool.query(`
      UPDATE cip_proyectos
      SET pdf_habilitado=$1,
          pdf_habilitado_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
          pdf_habilitado_por = CASE WHEN $1 THEN $2 ELSE NULL END,
          updated_at=NOW()
      WHERE id=$3 RETURNING *
    `, [habilitar, habilitado_por||null, id])

    await guardarHistorial(
      pool, id, null,
      habilitar ? "pdf_habilitado" : "pdf_deshabilitado",
      habilitado_por, habilitado_por_nombre,
      habilitar ? "PDF habilitado para descarga" : "PDF deshabilitado",
      habilitar
    )

    const io = req.app.get("io")
    io.to(r.rows[0].dependency_id.toString()).emit("cip_pdf_toggle", r.rows[0])

    res.json({
      ...r.rows[0],
      mensaje: habilitar
        ? "✅ PDF habilitado. La dependencia ya puede descargarlo."
        : "🔒 PDF deshabilitado. La dependencia no puede descargarlo."
    })
  } catch(e) {
    console.error("Error toggle PDF:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.regresarBorrador = async (req, res) => {
  try {
    const { id } = req.params
    const { usuario_nombre } = req.body

    const actual = await pool.query(`SELECT estado FROM cip_proyectos WHERE id=$1`, [id])
    if (!actual.rows[0]) return res.status(404).json({ error: "No encontrada" })

    const r = await pool.query(`
      UPDATE cip_proyectos
      SET estado='borrador', pdf_habilitado=FALSE,
          pdf_habilitado_at=NULL, pdf_habilitado_por=NULL,
          comentario_revision=NULL, updated_at=NOW()
      WHERE id=$1 RETURNING *
    `, [id])

    await guardarHistorial(pool, id, actual.rows[0].estado, "borrador", null, usuario_nombre, "Regresado a borrador", false)

    req.app.get("io").emit("cip_estado_cambio", r.rows[0])
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.getHistorial = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT h.*, u.name AS usuario_nombre_bd
      FROM cip_historial_estados h
      LEFT JOIN users u ON u.id = h.usuario_id
      WHERE h.proyecto_id = $1
      ORDER BY h.created_at ASC
    `, [req.params.id])
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.getStatsRevision = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado='borrador')::int  AS borradores,
        COUNT(*) FILTER (WHERE estado='enviado')::int   AS enviados,
        COUNT(*) FILTER (WHERE estado='aprobado')::int  AS aprobados,
        COUNT(*) FILTER (WHERE estado='rechazado')::int AS rechazados,
        COUNT(*) FILTER (WHERE pdf_habilitado=TRUE)::int AS con_pdf_habilitado
      FROM cip_proyectos
    `)
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.guardarWaypoints = async (req, res) => {
  try {
    const { id } = req.params
    const { waypoints, descripcion_ruta, distancia_km } = req.body

    if (!Array.isArray(waypoints)) {
      return res.status(400).json({ error: "waypoints debe ser un array" })
    }

    const r = await pool.query(`
      UPDATE cip_proyectos SET
        micro_waypoints              = $1,
        georef_micro_descripcion_ruta = $2,
        georef_micro_distancia_km     = $3,
        updated_at = NOW()
      WHERE id = $4 RETURNING id, nombre_proyecto,
        micro_waypoints, georef_micro_descripcion_ruta,
        georef_micro_distancia_km
    `, [
      JSON.stringify(waypoints),
      descripcion_ruta || null,
      distancia_km     || null,
      id
    ])

    if (!r.rows[0]) return res.status(404).json({ error: "CIP no encontrada" })
    res.json(r.rows[0])
  } catch(e) {
    console.error("Error guardando waypoints:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.getWaypoints = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, nombre_proyecto,
        georef_macro_lat, georef_macro_lng, georef_macro_localidad,
        georef_micro_lat, georef_micro_lng, georef_micro_localidad,
        micro_waypoints,
        georef_micro_descripcion_ruta,
        georef_micro_distancia_km
      FROM cip_proyectos WHERE id = $1
    `, [req.params.id])

    if (!r.rows[0]) return res.status(404).json({ error: "No encontrado" })

    const row = r.rows[0]
    if (typeof row.micro_waypoints === "string") {
      try { row.micro_waypoints = JSON.parse(row.micro_waypoints) }
      catch { row.micro_waypoints = [] }
    }
    if (!Array.isArray(row.micro_waypoints)) row.micro_waypoints = []

    res.json(row)
  } catch(e) { res.status(500).json({ error: e.message }) }
}
