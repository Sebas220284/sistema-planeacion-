const pool = require("../../../database/postgres")

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

exports.reporte1 = async (req, res) => {
  try {
    const { estado, anio } = req.query

    let where   = "WHERE 1=1"
    const params = []

    if (req.query.user_id) {
      const userRes = await pool.query(`
        SELECT r.name as rol 
        FROM users u 
        LEFT JOIN roles r ON u.role_id = r.id 
        WHERE u.id = $1
      `, [req.query.user_id]);
      if (userRes.rows.length > 0 && userRes.rows[0].rol === 'inversion_publica') {
        params.push(req.query.user_id)
        where += ` AND c.dependency_id IN (SELECT dependency_id FROM user_dependencias_asignadas WHERE user_id = $${params.length})`
      }
    }

    if (estado) {
      params.push(estado)
      where += ` AND c.estado = $${params.length}`
    }
    if (anio) {
      params.push(Number(anio))
      where += ` AND EXTRACT(YEAR FROM c.created_at) = $${params.length}`
    }

    const r = await pool.query(`
      SELECT
        d.id                                AS dependency_id,
        d.name                              AS dependencia_nombre,
        d.titular,
        COUNT(c.id)::int                    AS total_proyectos,
        COUNT(c.id) FILTER
          (WHERE c.estado='borrador')::int  AS proyectos_borrador,
        COUNT(c.id) FILTER
          (WHERE c.estado='enviado')::int   AS proyectos_enviados,
        COUNT(c.id) FILTER
          (WHERE c.estado='aprobado')::int  AS proyectos_aprobados,
        COUNT(c.id) FILTER
          (WHERE c.estado='rechazado')::int AS proyectos_rechazados,
        COALESCE(SUM(c.costo_total), 0)    AS monto_total,
        COALESCE(SUM(c.costo_total)
          FILTER (WHERE c.estado='aprobado'), 0) AS monto_aprobado,
        COALESCE(SUM(c.costo_total)
          FILTER (WHERE c.estado='enviado'), 0)  AS monto_en_revision,
        COALESCE(SUM(c.costo_total)
          FILTER (WHERE c.estado='borrador'), 0) AS monto_borrador,
        COUNT(c.id) FILTER
          (WHERE c.pdf_habilitado=TRUE)::int AS con_pdf,
        MAX(c.created_at)                   AS ultima_cip,
        EXTRACT(YEAR FROM MAX(c.created_at))::int AS anio
      FROM dependencies d
      INNER JOIN cip_proyectos c ON c.dependency_id = d.id
      ${where}
      GROUP BY d.id, d.name, d.titular
      ORDER BY SUM(c.costo_total) DESC NULLS LAST
    `, params)

    const totales = await pool.query(`
      SELECT
        COUNT(DISTINCT c.dependency_id)::int    AS total_dependencias,
        COUNT(c.id)::int                        AS total_proyectos,
        COALESCE(SUM(c.costo_total), 0)         AS gran_total,
        COALESCE(SUM(c.costo_total)
          FILTER (WHERE c.estado='aprobado'), 0) AS total_aprobado,
        COALESCE(SUM(c.costo_total)
          FILTER (WHERE c.estado='enviado'), 0)  AS total_en_revision,
        COALESCE(SUM(c.costo_total)
          FILTER (WHERE c.estado='borrador'), 0) AS total_borrador,
        COUNT(c.id) FILTER
          (WHERE c.estado='aprobado')::int       AS num_aprobados,
        COUNT(c.id) FILTER
          (WHERE c.estado='enviado')::int        AS num_enviados,
        COUNT(c.id) FILTER
          (WHERE c.estado='borrador')::int       AS num_borradores
      FROM cip_proyectos c
      INNER JOIN dependencies d ON d.id = c.dependency_id
      ${where}
    `, params)

    res.json({
      reporte:    "Resumen de CIPs por Dependencia",
      generado:   new Date().toISOString(),
      filtros:    { estado: estado || "todos", anio: anio || "todos" },
      dependencias: r.rows,
      totales:    totales.rows[0]
    })
  } catch(e) {
    console.error("Error reporte 1 CIP:", e)
    res.status(500).json({ error: e.message })
  }
}


exports.getAnios = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT DISTINCT EXTRACT(YEAR FROM created_at)::int AS anio
      FROM cip_proyectos
      ORDER BY anio DESC
    `)
    res.json(r.rows.map(x => x.anio))
  } catch(e) { res.status(500).json({ error: e.message }) }
}


exports.reporteLineasAccion = async (req, res) => {
  try {
    const { anio } = req.query;
    const currentAnio = anio || 2026;
    
    // We get total lines assigned to each dependency from v_semaforo_lineas
    // and total lines affected by CIP projects. 
    // And also we get the total CIP projects per dependency for the second bar if needed, 
    // but the user asked for:
    // Bar 1: lineas de accion totales (por dependencia)
    // Bar 2: lineas de accion afectadas por proyecto CIP
    const query = `
      SELECT 
          d.name AS dependencia_nombre,
          COUNT(DISTINCT pt.id)::int AS total_lineas,
          COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN pt.id END)::int AS lineas_afectadas,
          COUNT(DISTINCT c.id)::int AS total_proyectos
      FROM dependencies d
      LEFT JOIN planning_templates pt ON pt.dependency_id = d.id AND pt.ejercicio = $1
      LEFT JOIN cip_proyectos c ON c.dependency_id = d.id 
          AND c.anio = $1
          AND c.estado != 'rechazado'
          AND pt.lineas_accion = ANY(
              SELECT jsonb_array_elements_text(
                  CASE WHEN jsonb_typeof(c.pmd_lineas_accion::jsonb) = 'array' 
                       THEN c.pmd_lineas_accion::jsonb 
                       ELSE '[]'::jsonb 
                  END
              )
          )
      GROUP BY d.name
      HAVING COUNT(DISTINCT pt.id) > 0 OR COUNT(DISTINCT c.id) > 0
      ORDER BY total_lineas DESC;
    `;
    const r = await pool.query(query, [Number(currentAnio)]);
    res.json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};

exports.reporte2 = async (req, res) => {
  try {
    const { estado, anio, dep_id, agrupado = "false" } = req.query

    let where   = "WHERE costo_total > 0"
    const params = []

    if (estado) {
      params.push(estado)
      where += ` AND estado = $${params.length}`
    }
    if (anio) {
      params.push(Number(anio))
      where += ` AND anio = $${params.length}`
    }
    if (dep_id) {
      params.push(dep_id)
      where += ` AND dependency_id = $${params.length}`
    }

    const detalle = await pool.query(`
      SELECT *
      FROM v_reporte_cip_trimestres
      ${where}
      ORDER BY dependencia_nombre, nombre_proyecto
    `, params)

    let resumenWhere = "WHERE monto_total > 0"
    const resumenParams = []
    if (anio) {
      resumenParams.push(Number(anio))
      resumenWhere += ` AND anio = $${resumenParams.length}`
    }
    if (dep_id) {
      resumenParams.push(dep_id)
      resumenWhere += ` AND dependency_id = $${resumenParams.length}`
    }

    const resumen = await pool.query(`
      SELECT *
      FROM v_reporte_cip_dep_trimestres
      ${resumenWhere}
      ORDER BY monto_total DESC
    `, resumenParams)

    const totales = await pool.query(`
      SELECT
        COUNT(*)::int          AS total_cips,
        SUM(costo_total)       AS gran_total,
        SUM(monto_t1)          AS gran_total_t1,
        SUM(monto_t2)          AS gran_total_t2,
        SUM(monto_t3)          AS gran_total_t3,
        SUM(monto_t4)          AS gran_total_t4,
        COUNT(DISTINCT dependency_id)::int AS total_dependencias
      FROM v_reporte_cip_trimestres
      ${where}
    `, params)

    res.json({
      reporte:    "CIPs con Montos por Trimestre",
      generado:   new Date().toISOString(),
      filtros:    { estado: estado||"todos", anio: anio||"todos", dep_id: dep_id||"todas" },
      proyectos:  detalle.rows,
      por_dependencia: resumen.rows,
      totales:    totales.rows[0]
    })
  } catch(e) {
    console.error("Error reporte 2 CIP:", e)
    res.status(500).json({ error: e.message })
  }
}
exports.reportePorEje = async (req, res) => {
  try {
    const { estado, anio } = req.query
    let where = "WHERE 1=1"
    const params = []
    const pool = require("../../../database/postgres") // Ensure pool is accessible

    if (req.query.user_id) {
      const userRes = await pool.query(`
        SELECT r.name as rol 
        FROM users u 
        LEFT JOIN roles r ON u.role_id = r.id 
        WHERE u.id = $1
      `, [req.query.user_id]);
      if (userRes.rows.length > 0 && userRes.rows[0].rol === 'inversion_publica') {
        params.push(req.query.user_id)
        where += ` AND c.dependency_id IN (SELECT dependency_id FROM user_dependencias_asignadas WHERE user_id = $${params.length})`
      }
    }

    if (estado) {
      params.push(estado)
      where += ` AND c.estado = $${params.length}`
    }
    if (anio) {
      params.push(Number(anio))
      where += ` AND EXTRACT(YEAR FROM c.created_at) = $${params.length}`
    }

    const r = await pool.query(`
      SELECT
        COALESCE(c.plan_municipal, 'Sin Eje Asignado') AS eje,
        d.name                                  AS dependencia_nombre,
        COUNT(c.id)::int                        AS total_proyectos,
        COALESCE(SUM(c.costo_total), 0)         AS monto_total
      FROM cip_proyectos c
      LEFT JOIN dependencies d ON d.id = c.dependency_id
      ${where}
      GROUP BY COALESCE(c.plan_municipal, 'Sin Eje Asignado'), d.name
      ORDER BY SUM(c.costo_total) DESC
    `, params)

    const totales = await pool.query(`
      SELECT
        COUNT(c.id)::int                        AS total_proyectos,
        COALESCE(SUM(c.costo_total), 0)         AS gran_total
      FROM cip_proyectos c
      ${where}
    `, params)

    res.json({
      reporte: "Resumen de CIPs por Eje PMD",
      generado: new Date().toISOString(),
      filtros: { estado: estado || "todos", anio: anio || "todos" },
      ejes: r.rows,
      totales: totales.rows[0]
    })
  } catch(e) {
    console.error("Error reporte Eje CIP:", e)
    res.status(500).json({ error: e.message })
  }
}
