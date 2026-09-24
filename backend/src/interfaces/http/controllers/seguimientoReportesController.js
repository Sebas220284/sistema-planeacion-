const pool = require("../../../database/postgres")

const SEM = {
  optimo:    { color:"#16a34a", bg:"#d1fae5",  label:"Óptimo",   pct:"≥ 90%" },
  bueno:     { color:"#d97706", bg:"#fef3c7",  label:"Bueno",    pct:"70-89%" },
  regular:   { color:"#ea580c", bg:"#ffedd5", label:"Regular",  pct:"50-69%" },
  bajo:      { color:"#dc2626", bg:"#fee2e2",  label:"Bajo",     pct:"< 50%"  },
  sin_datos: { color:"#6b7280", bg:"#f3f4f6",  label:"Sin datos", pct:"—"     },
}

const fmt = (n) =>
  Number(n||0).toLocaleString("es-MX",{ minimumFractionDigits:2, maximumFractionDigits:2 })


exports.reporteAnual = async (req, res) => {
  try {
    const { anio = new Date().getFullYear(), dep_id } = req.query

    let extraWhere = ""
    const params   = [Number(anio)]
    if (dep_id) { params.push(dep_id); extraWhere = ` AND dependency_id=$${params.length}` }

    const deps = await pool.query(`
      SELECT * FROM v_rendimiento_dependencias
      WHERE anio=$1 ${extraWhere}
      ORDER BY cumplimiento_global DESC NULLS LAST
    `, params)

    const totales = await pool.query(`
      SELECT
        COUNT(DISTINCT dependency_id)::int  AS total_dependencias,
        SUM(total_lineas)::int              AS total_lineas,
        SUM(total_programado)               AS gran_total_programado,
        SUM(total_ejecutado)                AS gran_total_ejecutado,
        ROUND(AVG(cumplimiento_global)::NUMERIC,2) AS promedio_cumplimiento,
        SUM(lineas_optimo)::int             AS total_optimo,
        SUM(lineas_bueno)::int              AS total_bueno,
        SUM(lineas_regular)::int            AS total_regular,
        SUM(lineas_bajo)::int               AS total_bajo
      FROM v_rendimiento_dependencias
      WHERE anio=$1 ${extraWhere}
    `, params)

    const porEje = await pool.query(`
      SELECT
        pmd_eje,
        COUNT(linea_id)::int                AS total_lineas,
        SUM(total_programado)               AS programado,
        SUM(total_ejecutado)                AS ejecutado,
        ROUND(AVG(porcentaje_cumplimiento)::NUMERIC,2) AS cumplimiento_prom
      FROM v_seguimiento_lineas
      WHERE anio=$1 ${extraWhere}
        AND total_programado > 0
        AND pmd_eje IS NOT NULL
      GROUP BY pmd_eje
      ORDER BY cumplimiento_prom DESC
    `, params)

    res.json({
      tipo:       "anual",
      anio:       Number(anio),
      generado:   new Date().toISOString(),
      dependencias: deps.rows.map(d => ({
        ...d,
        semaforo_info: SEM[d.semaforo_global] || SEM.sin_datos
      })),
      totales:    totales.rows[0],
      por_eje:    porEje.rows,
      semaforo_ref: SEM
    })
  } catch(e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}


exports.reporteTrimestral = async (req, res) => {
  try {
    const { anio = new Date().getFullYear(), trimestre = 1, dep_id } = req.query
    const t = Number(trimestre)

    let extraWhere = ""
    const params   = [Number(anio)]
    if (dep_id) { params.push(dep_id); extraWhere = ` AND dependency_id=$${params.length}` }

    const lineas = await pool.query(`
      SELECT
        linea_id, lineas_accion, nomenclatura, unidad_medida,
        pmd_eje, pmd_estrategia, dependency_id, dependencia_nombre,
        strategy_nombre, anio,
        prog_t${t} AS programado_trimestre,
        ejec_t${t} AS ejecutado_trimestre,
        total_programado, total_ejecutado,
        porcentaje_cumplimiento,
        ROUND(
          (ejec_t${t} / NULLIF(prog_t${t},0) * 100)::NUMERIC
        ,2) AS cumplimiento_trimestre,
        CASE
          WHEN prog_t${t} = 0 THEN 'sin_datos'
          WHEN ejec_t${t}/NULLIF(prog_t${t},0)*100 >= 90 THEN 'optimo'
          WHEN ejec_t${t}/NULLIF(prog_t${t},0)*100 >= 70 THEN 'bueno'
          WHEN ejec_t${t}/NULLIF(prog_t${t},0)*100 >= 50 THEN 'regular'
          ELSE 'bajo'
        END AS semaforo_trimestre
      FROM v_seguimiento_lineas
      WHERE anio=$1 ${extraWhere}
      ORDER BY dependencia_nombre, porcentaje_cumplimiento ASC
    `, params)

    const totales = await pool.query(`
      SELECT
        COUNT(linea_id)::int                       AS total_lineas,
        SUM(prog_t${t})                            AS total_programado_t,
        SUM(ejec_t${t})                            AS total_ejecutado_t,
        ROUND(AVG(
          CASE WHEN prog_t${t} > 0
            THEN ejec_t${t}/NULLIF(prog_t${t},0)*100
          END
        )::NUMERIC,2) AS cumplimiento_promedio,
        COUNT(*) FILTER (WHERE prog_t${t}=0)::int  AS sin_programado,
        COUNT(*) FILTER (WHERE ejec_t${t}/NULLIF(prog_t${t},0)*100 >= 90)::int AS optimo,
        COUNT(*) FILTER (WHERE ejec_t${t}/NULLIF(prog_t${t},0)*100 >= 70
          AND ejec_t${t}/NULLIF(prog_t${t},0)*100 < 90)::int AS bueno,
        COUNT(*) FILTER (WHERE ejec_t${t}/NULLIF(prog_t${t},0)*100 >= 50
          AND ejec_t${t}/NULLIF(prog_t${t},0)*100 < 70)::int AS regular,
        COUNT(*) FILTER (WHERE prog_t${t} > 0
          AND ejec_t${t}/NULLIF(prog_t${t},0)*100 < 50)::int AS bajo
      FROM v_seguimiento_lineas
      WHERE anio=$1 ${extraWhere}
    `, params)

    res.json({
      tipo:       "trimestral",
      anio:       Number(anio),
      trimestre:  t,
      generado:   new Date().toISOString(),
      lineas:     lineas.rows.map(l => ({
        ...l,
        semaforo_info: SEM[l.semaforo_trimestre] || SEM.sin_datos
      })),
      totales:    totales.rows[0],
      semaforo_ref: SEM
    })
  } catch(e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}


exports.reporteTrianual = async (req, res) => {
  try {
    const { anio_inicio = 2024, anio_fin = 2026, dep_id } = req.query

    let extraWhere = ""
    const params   = [Number(anio_inicio), Number(anio_fin)]
    if (dep_id) { params.push(dep_id); extraWhere = ` AND dependency_id=$${params.length}` }

    const porAnio = await pool.query(`
      SELECT
        anio,
        COUNT(DISTINCT dependency_id)::int         AS total_deps,
        COUNT(linea_id)::int                       AS total_lineas,
        SUM(total_programado)                      AS total_programado,
        SUM(total_ejecutado)                       AS total_ejecutado,
        ROUND(
          (SUM(total_ejecutado)/NULLIF(SUM(total_programado),0)*100)::NUMERIC
        ,2) AS cumplimiento_global
      FROM v_seguimiento_lineas
      WHERE anio BETWEEN $1 AND $2 ${extraWhere}
        AND total_programado > 0
      GROUP BY anio
      ORDER BY anio
    `, params)

    const porDepTrianual = await pool.query(`
      SELECT
        dependency_id,
        dependencia_nombre,
        titular,
        SUM(total_programado)                                   AS total_programado_trianual,
        SUM(total_ejecutado)                                    AS total_ejecutado_trianual,
        ROUND(
          (SUM(total_ejecutado)/NULLIF(SUM(total_programado),0)*100)::NUMERIC
        ,2) AS cumplimiento_trianual,
        COUNT(DISTINCT anio)::int                               AS anios_con_datos,
        SUM(total_lineas)::int                                  AS total_lineas,
        -- Desglose por año
        SUM(total_programado) FILTER (WHERE anio=($1)::int)    AS prog_anio1,
        SUM(total_ejecutado)  FILTER (WHERE anio=($1)::int)    AS ejec_anio1,
        SUM(total_programado) FILTER (WHERE anio=($1+1)::int)  AS prog_anio2,
        SUM(total_ejecutado)  FILTER (WHERE anio=($1+1)::int)  AS ejec_anio2,
        SUM(total_programado) FILTER (WHERE anio=($2)::int)    AS prog_anio3,
        SUM(total_ejecutado)  FILTER (WHERE anio=($2)::int)    AS ejec_anio3
      FROM v_rendimiento_dependencias
      WHERE anio BETWEEN $1 AND $2 ${extraWhere}
      GROUP BY dependency_id, dependencia_nombre, titular
      ORDER BY cumplimiento_trianual DESC NULLS LAST
    `, params)

    const totalesTrianual = await pool.query(`
      SELECT
        SUM(total_programado)                AS gran_total_programado,
        SUM(total_ejecutado)                 AS gran_total_ejecutado,
        ROUND(
          (SUM(total_ejecutado)/NULLIF(SUM(total_programado),0)*100)::NUMERIC
        ,2) AS cumplimiento_global_trianual,
        COUNT(DISTINCT dependency_id)::int   AS total_dependencias
      FROM v_rendimiento_dependencias
      WHERE anio BETWEEN $1 AND $2 ${extraWhere}
    `, params)

    res.json({
      tipo:        "trianual",
      anio_inicio: Number(anio_inicio),
      anio_fin:    Number(anio_fin),
      generado:    new Date().toISOString(),
      por_anio:    porAnio.rows,
      dependencias: porDepTrianual.rows,
      totales:     totalesTrianual.rows[0],
      semaforo_ref: SEM
    })
  } catch(e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}

exports.rendimientoDependencia = async (req, res) => {
  try {
    const { dep_id }  = req.params
    const { anio = new Date().getFullYear() } = req.query

    const depInfo = await pool.query(
      `SELECT id, name, titular, enlace FROM dependencies WHERE id=$1`,
      [dep_id]
    )
    if (!depInfo.rows[0]) return res.status(404).json({ error: "Dependencia no encontrada" })

    const resumen = await pool.query(`
      SELECT * FROM v_rendimiento_dependencias
      WHERE dependency_id=$1 AND anio=$2
    `, [dep_id, Number(anio)])

    const lineas = await pool.query(`
      SELECT * FROM v_seguimiento_lineas
      WHERE dependency_id=$1 AND anio=$2
      ORDER BY porcentaje_cumplimiento ASC
    `, [dep_id, Number(anio)])

    const porEstrategia = await pool.query(`
      SELECT
        strategy_id,
        strategy_nombre,
        COUNT(linea_id)::int                              AS total_lineas,
        SUM(total_programado)                             AS programado,
        SUM(total_ejecutado)                              AS ejecutado,
        ROUND(AVG(porcentaje_cumplimiento)::NUMERIC,2)    AS cumplimiento_prom,
        COUNT(*) FILTER (WHERE semaforo='optimo')::int    AS optimo,
        COUNT(*) FILTER (WHERE semaforo='bueno')::int     AS bueno,
        COUNT(*) FILTER (WHERE semaforo='regular')::int   AS regular,
        COUNT(*) FILTER (WHERE semaforo='bajo')::int      AS bajo
      FROM v_seguimiento_lineas
      WHERE dependency_id=$1 AND anio=$2
      GROUP BY strategy_id, strategy_nombre
      ORDER BY cumplimiento_prom DESC
    `, [dep_id, Number(anio)])

    const evolucion = await pool.query(`
      SELECT
        SUM(prog_t1) AS prog_t1, SUM(ejec_t1) AS ejec_t1,
        SUM(prog_t2) AS prog_t2, SUM(ejec_t2) AS ejec_t2,
        SUM(prog_t3) AS prog_t3, SUM(ejec_t3) AS ejec_t3,
        SUM(prog_t4) AS prog_t4, SUM(ejec_t4) AS ejec_t4
      FROM v_seguimiento_lineas
      WHERE dependency_id=$1 AND anio=$2
    `, [dep_id, Number(anio)])

    const ev = evolucion.rows[0] || {}
    const evolucionFmt = [1,2,3,4].map(t => ({
      trimestre:   t,
      programado:  Number(ev[`prog_t${t}`]||0),
      ejecutado:   Number(ev[`ejec_t${t}`]||0),
      cumplimiento: ev[`prog_t${t}`] > 0
        ? Math.round((ev[`ejec_t${t}`]/ev[`prog_t${t}`])*10000)/100
        : 0
    }))

    res.json({
      dependencia:   { ...depInfo.rows[0], anio: Number(anio) },
      resumen:       resumen.rows[0] ? { ...resumen.rows[0], semaforo_info: SEM[resumen.rows[0].semaforo_global] } : null,
      lineas:        lineas.rows.map(l => ({ ...l, semaforo_info: SEM[l.semaforo]||SEM.sin_datos })),
      por_estrategia: porEstrategia.rows,
      evolucion_trimestral: evolucionFmt,
      semaforo_ref:  SEM,
      generado:      new Date().toISOString()
    })
  } catch(e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}

exports.getAnios = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT DISTINCT anio FROM planning_trimestres
      WHERE anio IS NOT NULL ORDER BY anio DESC
    `)
    res.json(r.rows.map(x=>x.anio))
  } catch(e) { res.status(500).json({ error: e.message }) }
}