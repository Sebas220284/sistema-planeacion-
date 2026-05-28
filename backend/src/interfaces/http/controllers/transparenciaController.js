const pool = require("../../../database/postgres")

exports.getConfig = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM transparencia_config WHERE seccion = $1`,
      [req.params.seccion]
    )
    if (result.rows.length === 0) {
      await pool.query(`INSERT INTO transparencia_config (seccion) VALUES ($1)`, [req.params.seccion])
      const nuevo = await pool.query(`SELECT * FROM transparencia_config WHERE seccion = $1`, [req.params.seccion])
      return res.json(nuevo.rows[0])
    }
    res.json(result.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: "Error" }) }
}

exports.updateConfig = async (req, res) => {
  try {
    const { ejercicio, fecha_inicio, fecha_termino, titulo, hipervinculos, area_responsable, fecha_actualizacion, nota } = req.body
    const result = await pool.query(`
      UPDATE transparencia_config SET
        ejercicio=$1, fecha_inicio=$2, fecha_termino=$3, titulo=$4,
        hipervinculos=$5, area_responsable=$6, fecha_actualizacion=$7, nota=$8
      WHERE seccion=$9 RETURNING *
    `, [ejercicio, fecha_inicio, fecha_termino, titulo, hipervinculos, area_responsable, fecha_actualizacion, nota, req.params.seccion])
    res.json(result.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: "Error actualizando config" }) }
}

exports.getSeccion4 = async (req, res) => {
  try {
    const config = await pool.query(`SELECT * FROM transparencia_config WHERE seccion = '4'`)
    const cfg = config.rows[0] || {}

    const datos = await pool.query(`
      SELECT
        pt.id,
        pt.pmd_objetivo        as descripcion,
        pt.lineas_accion       as nombre_corto,
        pt.nombre2             as nombre2,
        pt.pmd_eje             as eje,
        pt.pmd_tema            as tema,
        pt.pmd_estrategia      as estrategia,
        pt.nomenclatura        as nomenclatura,
        d.name                 as denominacion_area,
        d.titular              as titular,
        d.enlace               as enlace,
        ROW_NUMBER() OVER (ORDER BY d.name, pt.id) as tabla_campo_id
      FROM planning_templates pt
      JOIN dependencies d ON d.id = pt.dependency_id
      WHERE pt.estado = 'aprobado'
      ORDER BY d.name, pt.id
    `)

    res.json({
      config: cfg,
      filas: datos.rows.map(row => ({
        ejercicio:          cfg.ejercicio || 2025,
        fecha_inicio:       cfg.fecha_inicio ? new Date(cfg.fecha_inicio).toLocaleDateString("es-MX") : "1/1/2025",
        titulo:             cfg.titulo || "Objetivos y metas institucionales",
        fecha_termino:      cfg.fecha_termino ? new Date(cfg.fecha_termino).toLocaleDateString("es-MX") : "31/12/2025",
        denominacion_area:  row.denominacion_area,
        descripcion:        row.descripcion,
        nombre_corto:       row.nombre_corto || row.nombre2,
        tabla_campo_id:     310000 + Number(row.tabla_campo_id),
        hipervinculos:      cfg.hipervinculos || "",
        area_responsable:   cfg.area_responsable || "Secretaría de Planeación_Dirección de Seguimiento y Evaluación",
        fecha_actualizacion: cfg.fecha_actualizacion ? new Date(cfg.fecha_actualizacion).toLocaleDateString("es-MX") : "31/12/2025",
        nota:               cfg.nota || "",
        eje:                row.eje,
        tema:               row.tema,
        estrategia:         row.estrategia,
        nomenclatura:       row.nomenclatura,
      }))
    })
  } catch(e) { console.error(e); res.status(500).json({ error: "Error generando sección 4" }) }
}
exports.getSeccion5 = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, u.name as creado_por_nombre, u.email as creado_por_email
      FROM transparencia_seccion5 s
      LEFT JOIN users u ON u.id = s.creado_por
      ORDER BY s.created_at ASC
    `)
    res.json(result.rows)
  } catch(e) { console.error(e); res.status(500).json({ error: "Error obteniendo sección 5" }) }
}

exports.crearSeccion5 = async (req, res) => {
  try {
    const {
      ejercicio, fecha_inicio, fecha_termino, objetivo_institucional,
      nombre_indicador, dimension, definicion_indicador, metodo_calculo,
      unidad_medida, frecuencia_medicion, linea_base, metas_programadas,
      metas_ajustadas, avance_metas, sentido_indicador, fuente_informacion,
      area_responsable, fecha_actualizacion, nota, creado_por
    } = req.body

    const result = await pool.query(`
      INSERT INTO transparencia_seccion5 (
        ejercicio, fecha_inicio, fecha_termino, objetivo_institucional,
        nombre_indicador, dimension, definicion_indicador, metodo_calculo,
        unidad_medida, frecuencia_medicion, linea_base, metas_programadas,
        metas_ajustadas, avance_metas, sentido_indicador, fuente_informacion,
        area_responsable, fecha_actualizacion, nota, creado_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *
    `, [
      ejercicio||2025, fecha_inicio||'2025-10-01', fecha_termino||'2025-12-31',
      objetivo_institucional, nombre_indicador, dimension, definicion_indicador,
      metodo_calculo, unidad_medida, frecuencia_medicion||'Trimestral',
      linea_base||'N/D', metas_programadas||0, metas_ajustadas||0,
      avance_metas||0, sentido_indicador||'Ascendente', fuente_informacion,
      area_responsable, fecha_actualizacion||'2025-12-31', nota, creado_por||null
    ])
    res.json(result.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: "Error creando registro" }) }
}

exports.actualizarSeccion5 = async (req, res) => {
  try {
    const {
      ejercicio, fecha_inicio, fecha_termino, objetivo_institucional,
      nombre_indicador, dimension, definicion_indicador, metodo_calculo,
      unidad_medida, frecuencia_medicion, linea_base, metas_programadas,
      metas_ajustadas, avance_metas, sentido_indicador, fuente_informacion,
      area_responsable, fecha_actualizacion, nota
    } = req.body

    const result = await pool.query(`
      UPDATE transparencia_seccion5 SET
        ejercicio=$1, fecha_inicio=$2, fecha_termino=$3, objetivo_institucional=$4,
        nombre_indicador=$5, dimension=$6, definicion_indicador=$7, metodo_calculo=$8,
        unidad_medida=$9, frecuencia_medicion=$10, linea_base=$11, metas_programadas=$12,
        metas_ajustadas=$13, avance_metas=$14, sentido_indicador=$15, fuente_informacion=$16,
        area_responsable=$17, fecha_actualizacion=$18, nota=$19, updated_at=NOW()
      WHERE id=$20 RETURNING *
    `, [
      ejercicio, fecha_inicio, fecha_termino, objetivo_institucional,
      nombre_indicador, dimension, definicion_indicador, metodo_calculo,
      unidad_medida, frecuencia_medicion, linea_base, metas_programadas,
      metas_ajustadas, avance_metas, sentido_indicador, fuente_informacion,
      area_responsable, fecha_actualizacion, nota, req.params.id
    ])
    res.json(result.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: "Error actualizando" }) }
}

exports.eliminarSeccion5 = async (req, res) => {
  try {
    await pool.query(`DELETE FROM transparencia_seccion5 WHERE id=$1`, [req.params.id])
    res.json({ ok: true })
  } catch(e) { console.error(e); res.status(500).json({ error: "Error eliminando" }) }
}
  exports.getSeccion6 = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, u.name as creado_por_nombre, u.email as creado_por_email
      FROM transparencia_seccion6 s
      LEFT JOIN users u ON u.id = s.creado_por
      ORDER BY s.created_at ASC
    `)
    res.json(result.rows)
  } catch(e) { console.error(e); res.status(500).json({ error: "Error obteniendo sección 6" }) }
}

exports.crearSeccion6 = async (req, res) => {
  try {
    const {
      ejercicio, fecha_inicio, fecha_termino, nombre_programa,
      objetivo_institucional, nombre_indicador, dimension,
      definicion_indicador, metodo_calculo, unidad_medida,
      frecuencia_medicion, linea_base, metas_programadas,
      metas_ajustadas, avance_metas, sentido_indicador,
      fuente_informacion, area_responsable, fecha_actualizacion,
      nota, creado_por
    } = req.body

    const result = await pool.query(`
      INSERT INTO transparencia_seccion6 (
        ejercicio, fecha_inicio, fecha_termino, nombre_programa,
        objetivo_institucional, nombre_indicador, dimension,
        definicion_indicador, metodo_calculo, unidad_medida,
        frecuencia_medicion, linea_base, metas_programadas,
        metas_ajustadas, avance_metas, sentido_indicador,
        fuente_informacion, area_responsable, fecha_actualizacion,
        nota, creado_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *
    `, [
      ejercicio||2025, fecha_inicio||'2025-10-01', fecha_termino||'2025-12-31',
      nombre_programa||'Programa Operativo Anual',
      objetivo_institucional, nombre_indicador, dimension||'Gestión',
      definicion_indicador, metodo_calculo, unidad_medida,
      frecuencia_medicion||'Trimestral', linea_base||'ND',
      metas_programadas||0, metas_ajustadas||0, avance_metas||0,
      sentido_indicador||'Ascendente', fuente_informacion,
      area_responsable, fecha_actualizacion||'2025-12-31', nota, creado_por||null
    ])
    res.json(result.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: "Error creando" }) }
}

exports.actualizarSeccion6 = async (req, res) => {
  try {
    const {
      ejercicio, fecha_inicio, fecha_termino, nombre_programa,
      objetivo_institucional, nombre_indicador, dimension,
      definicion_indicador, metodo_calculo, unidad_medida,
      frecuencia_medicion, linea_base, metas_programadas,
      metas_ajustadas, avance_metas, sentido_indicador,
      fuente_informacion, area_responsable, fecha_actualizacion, nota
    } = req.body

    const result = await pool.query(`
      UPDATE transparencia_seccion6 SET
        ejercicio=$1, fecha_inicio=$2, fecha_termino=$3, nombre_programa=$4,
        objetivo_institucional=$5, nombre_indicador=$6, dimension=$7,
        definicion_indicador=$8, metodo_calculo=$9, unidad_medida=$10,
        frecuencia_medicion=$11, linea_base=$12, metas_programadas=$13,
        metas_ajustadas=$14, avance_metas=$15, sentido_indicador=$16,
        fuente_informacion=$17, area_responsable=$18,
        fecha_actualizacion=$19, nota=$20, updated_at=NOW()
      WHERE id=$21 RETURNING *
    `, [
      ejercicio, fecha_inicio, fecha_termino, nombre_programa,
      objetivo_institucional, nombre_indicador, dimension,
      definicion_indicador, metodo_calculo, unidad_medida,
      frecuencia_medicion, linea_base, metas_programadas,
      metas_ajustadas, avance_metas, sentido_indicador,
      fuente_informacion, area_responsable, fecha_actualizacion,
      nota, req.params.id
    ])
    res.json(result.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: "Error actualizando" }) }
}

exports.eliminarSeccion6 = async (req, res) => {
  try {
    await pool.query(`DELETE FROM transparencia_seccion6 WHERE id=$1`, [req.params.id])
    res.json({ ok: true })
  } catch(e) { console.error(e); res.status(500).json({ error: "Error eliminando" }) }
}

exports.getSeccion40 = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, u.name as creado_por_nombre, u.email as creado_por_email
      FROM transparencia_seccion40 s
      LEFT JOIN users u ON u.id = s.creado_por
      ORDER BY s.created_at ASC
    `)
    res.json(result.rows)
  } catch(e) { console.error(e); res.status(500).json({ error: "Error obteniendo sección 40" }) }
}

exports.crearSeccion40 = async (req, res) => {
  try {
    const {
      ejercicio, fecha_inicio_periodo, fecha_termino_periodo,
      denominacion_programa, denominacion_evaluacion, objetivo_general,
      fecha_inicio_evaluacion, fecha_termino_evaluacion, hipervinculos,
      area_responsable, fecha_actualizacion, nota, creado_por
    } = req.body

    const result = await pool.query(`
      INSERT INTO transparencia_seccion40 (
        ejercicio, fecha_inicio_periodo, fecha_termino_periodo,
        denominacion_programa, denominacion_evaluacion, objetivo_general,
        fecha_inicio_evaluacion, fecha_termino_evaluacion, hipervinculos,
        area_responsable, fecha_actualizacion, nota, creado_por
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
      ejercicio||2025,
      fecha_inicio_periodo||'2025-10-01',
      fecha_termino_periodo||'2025-12-31',
      denominacion_programa,
      denominacion_evaluacion||null,
      objetivo_general||null,
      fecha_inicio_evaluacion||null,
      fecha_termino_evaluacion||null,
      hipervinculos||null,
      area_responsable||'Secretaría de Planeación_Dirección de Seguimiento y Evaluación',
      fecha_actualizacion||'2025-12-31',
      nota||null,
      creado_por||null
    ])
    res.json(result.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: "Error creando" }) }
}

exports.actualizarSeccion40 = async (req, res) => {
  try {
    const {
      ejercicio, fecha_inicio_periodo, fecha_termino_periodo,
      denominacion_programa, denominacion_evaluacion, objetivo_general,
      fecha_inicio_evaluacion, fecha_termino_evaluacion, hipervinculos,
      area_responsable, fecha_actualizacion, nota
    } = req.body

    const result = await pool.query(`
      UPDATE transparencia_seccion40 SET
        ejercicio=$1, fecha_inicio_periodo=$2, fecha_termino_periodo=$3,
        denominacion_programa=$4, denominacion_evaluacion=$5,
        objetivo_general=$6, fecha_inicio_evaluacion=$7,
        fecha_termino_evaluacion=$8, hipervinculos=$9,
        area_responsable=$10, fecha_actualizacion=$11, nota=$12,
        updated_at=NOW()
      WHERE id=$13 RETURNING *
    `, [
      ejercicio, fecha_inicio_periodo, fecha_termino_periodo,
      denominacion_programa, denominacion_evaluacion, objetivo_general,
      fecha_inicio_evaluacion||null, fecha_termino_evaluacion||null,
      hipervinculos, area_responsable, fecha_actualizacion, nota,
      req.params.id
    ])
    res.json(result.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: "Error actualizando" }) }
}

exports.eliminarSeccion40 = async (req, res) => {
  try {
    await pool.query(`DELETE FROM transparencia_seccion40 WHERE id=$1`, [req.params.id])
    res.json({ ok: true })
  } catch(e) { console.error(e); res.status(500).json({ error: "Error eliminando" }) }
}