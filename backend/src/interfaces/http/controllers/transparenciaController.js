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
        // extras para referencia
        eje:                row.eje,
        tema:               row.tema,
        estrategia:         row.estrategia,
        nomenclatura:       row.nomenclatura,
      }))
    })
  } catch(e) { console.error(e); res.status(500).json({ error: "Error generando sección 4" }) }
}