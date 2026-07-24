const pool = require("../../../database/postgres")

const CAMPOS = [
  "dependency_id","strategy_id","nombre_indicador","definicion","proposito","formula",
  "eje","tema","politica_publica","objetivo","estrategia",
  "anio","tipo_evaluacion","periodicidad","tipo_indicador","informe_gobierno",
  "anio_base","valor_anio_base","valor_minimo","valor_inicial","avance_anual",
  "meta_anual","meta_trianual","producto","analisis_cualitativo","unidad_medida",
  "medios_verificacion","supuestos","responsable","correo_electronico","telefono",
  "criterio_claro","criterio_relevante","criterio_economico","criterio_monitoreable",
  "criterio_adecuado","criterio_aportacion","calendarizacion","creado_por"
]

const CAMPOS_HIST = [
  "dependency_id","strategy_id","nombre_indicador","definicion","proposito","formula",
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
    const vals = CAMPOS.map(c => (req.body[c] === "" ? null : (req.body[c] ?? null)))
    const cols = CAMPOS.join(",")
    const params = CAMPOS.map((_,i) => `$${i+1}`).join(",")
    const result = await pool.query(
      `INSERT INTO fichas_tecnicas (${cols}) VALUES (${params}) RETURNING *`, vals
    )
    const full = await pool.query(`
      SELECT f.*, d.name as dependencia_nombre, d.titular, d.enlace,
        uc.name as creado_por_nombre, uc.email as creado_por_email
      FROM fichas_tecnicas f
      LEFT JOIN dependencies d ON d.id = f.dependency_id
      LEFT JOIN users uc ON uc.id = f.creado_por
      WHERE f.id = $1
    `, [result.rows[0].id])
    req.app.get("io").to("planeacion").emit("nueva_ficha", full.rows[0])
    res.json(full.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: "Error creando ficha" }) }
}

exports.lista = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, d.name as dependencia_nombre, d.titular, d.enlace,
        uc.name as creado_por_nombre, uc.email as creado_por_email,
        ua.name as actualizado_por_nombre, ua.email as actualizado_por_email
      FROM fichas_tecnicas f
      LEFT JOIN dependencies d ON d.id = f.dependency_id
      LEFT JOIN users uc ON uc.id = f.creado_por
      LEFT JOIN users ua ON ua.id = f.actualizado_por
      ORDER BY f.created_at DESC
    `)
    res.json(result.rows)
  } catch(e) { console.error(e); res.status(500).json({ error: "Error" }) }
}

exports.porDependencia = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, d.name as dependencia_nombre, d.titular, d.enlace,
        uc.name as creado_por_nombre, uc.email as creado_por_email,
        ua.name as actualizado_por_nombre, ua.email as actualizado_por_email
      FROM fichas_tecnicas f
      LEFT JOIN dependencies d ON d.id = f.dependency_id
      LEFT JOIN users uc ON uc.id = f.creado_por
      LEFT JOIN users ua ON ua.id = f.actualizado_por
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

    const actual = await pool.query(`SELECT * FROM fichas_tecnicas WHERE id = $1`, [id])
    if (actual.rows.length > 0) {
      const ficha = actual.rows[0]
      const ultVer = await pool.query(
        `SELECT COALESCE(MAX(version),0) as max_ver FROM fichas_tecnicas_historial WHERE ficha_id = $1`, [id]
      )
      const nextVersion = Number(ultVer.rows[0].max_ver) + 1
      const histCols = ["ficha_id","version","modificado_por","comentario_cambio", ...CAMPOS_HIST]
      const histVals = [id, nextVersion, modificado_por||null, comentario_cambio||null, ...CAMPOS_HIST.map(c => ficha[c] ?? null)]
      const histParams = histVals.map((_,i) => `$${i+1}`).join(",")
      await pool.query(`INSERT INTO fichas_tecnicas_historial (${histCols.join(",")}) VALUES (${histParams})`, histVals)
    }

    const campos = CAMPOS.filter(c => c !== "creado_por")
    const vals = campos.map(c => (req.body[c] === "" ? null : (req.body[c] ?? null)))
    const sets = campos.map((c,i) => `${c}=$${i+1}`).join(",")
    const extraIdx = vals.length + 1
    vals.push(modificado_por||null)
    vals.push(id)
    const result = await pool.query(
      `UPDATE fichas_tecnicas SET ${sets}, actualizado_por=$${extraIdx}, fecha_actualizacion=NOW() WHERE id=$${extraIdx+1} RETURNING *`, vals
    )

    const full = await pool.query(`
      SELECT f.*, d.name as dependencia_nombre, d.titular, d.enlace,
        uc.name as creado_por_nombre, uc.email as creado_por_email,
        ua.name as actualizado_por_nombre, ua.email as actualizado_por_email
      FROM fichas_tecnicas f
      LEFT JOIN dependencies d ON d.id = f.dependency_id
      LEFT JOIN users uc ON uc.id = f.creado_por
      LEFT JOIN users ua ON ua.id = f.actualizado_por
      WHERE f.id = $1
    `, [result.rows[0].id])
    res.json(full.rows[0])
  } catch(e) { console.error(e); res.status(500).json({ error: "Error actualizando" }) }
}

exports.historial = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT h.*, d.name as dependencia_nombre,
        um.name as modificado_por_nombre, um.email as modificado_por_email
      FROM fichas_tecnicas_historial h
      LEFT JOIN dependencies d ON d.id = h.dependency_id
      LEFT JOIN users um ON um.id = h.modificado_por
      WHERE h.ficha_id = $1
      ORDER BY h.version DESC
    `, [req.params.ficha_id])
    res.json(result.rows)
  } catch(e) { console.error(e); res.status(500).json({ error: "Error obteniendo historial" }) }
}
exports.eliminar = async (req, res) => {
  try {
    await pool.query(`DELETE FROM fichas_tecnicas WHERE id=$1`, [req.params.id])
    res.json({ ok: true })
  } catch(e) { console.error(e); res.status(500).json({ error: "Error eliminando" }) }
}
exports.estrategiasPorDependencia = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id as strategy_id, s.name as strategy_name, s.name as estrategia
      FROM strategies s
      JOIN planning_templates p ON p.strategy_id = s.id
      WHERE p.dependency_id=$1 AND p.pmd_estrategia IS NOT NULL
      GROUP BY s.id, s.name
      ORDER BY s.name
    `, [req.params.dependency_id])
    res.json(result.rows)
  } catch(e) { console.error(e); res.status(500).json({ error: "Error" }) }
}

exports.lineasPorDependencia = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        pt.id,
        pt.lineas_accion,
        pt.nombre2,
        pt.pmd_eje,
        pt.pmd_tema,
        pt.pmd_politica_publica,
        pt.pmd_objetivo,
        pt.pmd_estrategia,
        pt.unidad_medida,
        pt.nomenclatura,
        pt.ejercicio,
        s.name AS strategy_nombre,
        s.id   AS strategy_id
      FROM planning_templates pt
      LEFT JOIN strategies s ON s.id = pt.strategy_id
      WHERE pt.dependency_id = $1
      ORDER BY pt.pmd_eje, pt.pmd_estrategia, pt.lineas_accion
    `, [req.params.dependency_id])

    res.json(r.rows)
  } catch(e) {
    console.error("Error lineas por dep:", e)
    res.status(500).json({ error: e.message })
  }
}


exports.datosParaFicha = async (req, res) => {
  try {
    const { planning_id, anio } = req.params
    const anioNum = parseInt(anio) || new Date().getFullYear()

    const linea = await pool.query(`
      SELECT
        pt.*,
        d.name    AS dependencia_nombre,
        d.titular AS dependencia_titular,
        d.enlace  AS dependencia_enlace,
        s.name    AS strategy_nombre
      FROM planning_templates pt
      JOIN dependencies d ON d.id = pt.dependency_id
      LEFT JOIN strategies s ON s.id = pt.strategy_id
      WHERE pt.id = $1
    `, [planning_id])

    if (!linea.rows[0]) {
      return res.status(404).json({ error: "Línea de acción no encontrada" })
    }

    const l = linea.rows[0]

    const trimestres = await pool.query(`
      SELECT trimestre, tipo, valor, anio
      FROM planning_trimestres
      WHERE planning_id = $1 AND anio = $2
      ORDER BY trimestre, tipo
    `, [planning_id, anioNum])

    const datosT = { programado:{1:0,2:0,3:0,4:0}, ejecutado:{1:0,2:0,3:0,4:0} }
    trimestres.rows.forEach(t => {
      if (datosT[t.tipo] && t.trimestre >= 1 && t.trimestre <= 4) {
        datosT[t.tipo][t.trimestre] = Number(t.valor || 0)
      }
    })

    const totalProgramado = Object.values(datosT.programado).reduce((s,v)=>s+v, 0)
    const totalEjecutado  = Object.values(datosT.ejecutado ).reduce((s,v)=>s+v, 0)
    const valorInicial    = datosT.programado[1] || 0

    const mesesPorTrimestre = {
      1: ["enero","febrero","marzo"],
      2: ["abril","mayo","junio"],
      3: ["julio","agosto","septiembre"],
      4: ["octubre","noviembre","diciembre"]
    }

    const calendarizacion = {}
    ;[1,2,3,4].forEach(t => {
      const meses = mesesPorTrimestre[t]
      const progT = datosT.programado[t]
      const ejecT = datosT.ejecutado[t]
      meses.forEach(mes => {
        calendarizacion[mes] = {
          programado: Math.round(progT / 3),
          real:       Math.round(ejecT / 3)
        }
      })
    })

    res.json({
      nombre_indicador:   l.lineas_accion || l.nombre2 || "",
      definicion:         l.lineas_accion || "",
      proposito:          l.pmd_objetivo  || "",
      formula:            `(Número de ${l.unidad_medida || "acciones"} realizadas / Número de ${l.unidad_medida || "acciones"} programadas) * 100`,
      unidad_medida:      l.unidad_medida || "",
      medios_verificacion: "Informe de actividades / Reportes de seguimiento",

      pmd_eje:              l.pmd_eje              || "",
      pmd_tema:             l.pmd_tema             || "",
      pmd_politica_publica: l.pmd_politica_publica || "",
      pmd_objetivo:         l.pmd_objetivo         || "",
      pmd_estrategia:       l.pmd_estrategia       || "",
      strategy_id:          l.strategy_id          || null,
      strategy_nombre:      l.strategy_nombre      || "",

      dependency_id:       l.dependency_id,
      dependencia_nombre:  l.dependencia_nombre,
      responsable:         l.dependencia_titular   || "",
      correo_electronico:  l.dependencia_enlace    || "",

      anio:                anioNum,
      periodicidad:        "Trimestral",
      tipo_indicador:      "Gestión",
      tipo_evaluacion:     "Porcentaje",

      valor_inicial:   valorInicial,
      avance_anual:    totalEjecutado,
      meta_anual:      totalProgramado,
      meta_trianual:   totalProgramado * 3,
      anio_base:       anioNum - 1,
      valor_anio_base: 0,
      valor_minimo:    0,

      calendarizacion,

      trimestres_raw: datosT,
      planning_template_id: planning_id,

      resumen_trimestral: [1,2,3,4].map(t => ({
        trimestre:   t,
        programado:  datosT.programado[t],
        ejecutado:   datosT.ejecutado[t],
        cumplimiento: datosT.programado[t] > 0
          ? Math.round((datosT.ejecutado[t] / datosT.programado[t]) * 100)
          : 0
      }))
    })
  } catch(e) {
    console.error("Error datos para ficha:", e)
    res.status(500).json({ error: e.message })
  }
}


exports.datosParaEstrategia = async (req, res) => {
  try {
    const { strategy_id, anio } = req.params;
    const anioNum = parseInt(anio) || new Date().getFullYear();

    const estrategiaQuery = await pool.query(`
      SELECT 
        s.id as strategy_id,
        s.name as strategy_nombre,
        d.id as dependency_id,
        d.name as dependencia_nombre,
        d.titular as dependencia_titular,
        d.enlace as dependencia_enlace,
        MAX(pt.pmd_eje) as pmd_eje,
        MAX(pt.pmd_tema) as pmd_tema,
        MAX(pt.pmd_politica_publica) as pmd_politica_publica,
        MAX(pt.pmd_objetivo) as pmd_objetivo,
        MAX(pt.pmd_estrategia) as pmd_estrategia,
        MAX(pt.unidad_medida) as unidad_medida,
        MAX(pt.lineas_accion) as lineas_accion
      FROM strategies s
      JOIN planning_templates pt ON pt.strategy_id = s.id
      JOIN dependencies d ON d.id = pt.dependency_id
      WHERE s.id = $1
      GROUP BY s.id, d.id
    `, [strategy_id]);

    if (!estrategiaQuery.rows[0]) {
      return res.status(404).json({ error: "Estrategia no encontrada o sin líneas de acción asociadas" });
    }

    const est = estrategiaQuery.rows[0];

    const trimestres = await pool.query(`
      SELECT trimestre, tipo, SUM(valor) as valor, anio
      FROM planning_trimestres tr
      JOIN planning_templates pt ON pt.id = tr.planning_id
      WHERE pt.strategy_id = $1 AND tr.anio = $2
      GROUP BY trimestre, tipo, anio
      ORDER BY trimestre, tipo
    `, [strategy_id, anioNum]);

    const datosT = { programado:{1:0,2:0,3:0,4:0}, ejecutado:{1:0,2:0,3:0,4:0} };
    trimestres.rows.forEach(t => {
      if (datosT[t.tipo] && t.trimestre >= 1 && t.trimestre <= 4) {
        datosT[t.tipo][t.trimestre] = Number(t.valor || 0);
      }
    });

    const totalProgramado = Object.values(datosT.programado).reduce((s,v)=>s+v, 0);
    const totalEjecutado  = Object.values(datosT.ejecutado ).reduce((s,v)=>s+v, 0);
    const valorInicial    = datosT.programado[1] || 0;

    const mesesPorTrimestre = {
      1: ["enero","febrero","marzo"],
      2: ["abril","mayo","junio"],
      3: ["julio","agosto","septiembre"],
      4: ["octubre","noviembre","diciembre"]
    };

    const calendarizacion = {};
    [1,2,3,4].forEach(t => {
      const meses = mesesPorTrimestre[t];
      const progT = datosT.programado[t];
      const ejecT = datosT.ejecutado[t];
      meses.forEach(mes => {
        calendarizacion[mes] = {
          programado: Math.round(progT / 3),
          real:       Math.round(ejecT / 3)
        };
      });
    });

    res.json({
      nombre_indicador:   est.strategy_nombre || est.lineas_accion || "",
      definicion:         est.strategy_nombre || est.lineas_accion || "",
      proposito:          est.pmd_objetivo  || "",
      formula:            est.unidad_medida ? `(Número de ${est.unidad_medida} realizadas / Número de ${est.unidad_medida} programadas) * 100` : "",
      unidad_medida:      est.unidad_medida || "",
      medios_verificacion: "Informe de actividades / Reportes de seguimiento",

      pmd_eje:              est.pmd_eje              || "",
      pmd_tema:             est.pmd_tema             || "",
      pmd_politica_publica: est.pmd_politica_publica || "",
      pmd_objetivo:         est.pmd_objetivo         || "",
      pmd_estrategia:       est.pmd_estrategia       || "",
      strategy_id:          est.strategy_id          || null,
      strategy_nombre:      est.strategy_nombre      || "",

      dependency_id:       est.dependency_id,
      dependencia_nombre:  est.dependencia_nombre,
      responsable:         est.dependencia_titular   || "",
      correo_electronico:  est.dependencia_enlace    || "",

      anio:                anioNum,
      periodicidad:        "Trimestral",
      tipo_indicador:      "Gestión",
      tipo_evaluacion:     "Porcentaje",

      valor_inicial:       valorInicial,
      meta_anual:          totalProgramado,
      avance_anual:        totalEjecutado,
      calendarizacion,

      trimestres_raw: datosT,
      resumen_trimestral: [1,2,3,4].map(t => ({
        trimestre:   t,
        programado:  datosT.programado[t],
        ejecutado:   datosT.ejecutado[t],
        cumplimiento: datosT.programado[t] > 0
          ? Math.round((datosT.ejecutado[t] / datosT.programado[t]) * 100)
          : 0
      }))
    });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}

exports.listaConPOA = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        f.*,
        d.name  AS dependencia_nombre,
        d.titular, d.enlace,
        uc.name  AS creado_por_nombre,
        uc.email AS creado_por_email,
        ua.name  AS actualizado_por_nombre,
        ua.email AS actualizado_por_email,
        st.name AS poa_linea,
        -- Suma de ejecutado del año desde trimestres
        COALESCE((
          SELECT SUM(tr.valor)
          FROM planning_trimestres tr
          JOIN planning_templates pt ON pt.id = tr.planning_id
          WHERE pt.strategy_id = f.strategy_id
            AND tr.tipo = 'ejecutado'
            AND tr.anio = f.anio
        ), 0) AS ejecutado_real_poa,
        -- Suma de programado del año desde trimestres
        COALESCE((
          SELECT SUM(tr.valor)
          FROM planning_trimestres tr
          JOIN planning_templates pt ON pt.id = tr.planning_id
          WHERE pt.strategy_id = f.strategy_id
            AND tr.tipo = 'programado'
            AND tr.anio = f.anio
        ), 0) AS programado_real_poa
      FROM fichas_tecnicas f
      LEFT JOIN dependencies d   ON d.id  = f.dependency_id
      LEFT JOIN users uc          ON uc.id = f.creado_por
      LEFT JOIN users ua          ON ua.id = f.actualizado_por
      LEFT JOIN strategies st ON st.id = f.strategy_id
      ORDER BY f.created_at DESC
    `)
    res.json(r.rows)
  } catch(e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}



exports.ponderacionPorEstrategia = async (req, res) => {
  try {
    const { dependency_id } = req.params
    const anio_inicio = parseInt(req.query.anio_inicio) || 2024
    const anio_fin    = parseInt(req.query.anio_fin)    || 2026

    const rawData = await pool.query(`
      SELECT
        pt.strategy_id,
        s.name                             AS strategy_nombre,
        pt.pmd_eje,
        pt.pmd_tema,
        pt.pmd_politica_publica,
        pt.pmd_objetivo,
        pt.pmd_estrategia,
        tr.anio,
        tr.tipo,
        COALESCE(SUM(tr.valor), 0)         AS total_valor,
        COUNT(DISTINCT pt.id)::int         AS total_lineas
      FROM planning_templates pt
      JOIN strategies s ON s.id = pt.strategy_id
      LEFT JOIN planning_trimestres tr
        ON tr.planning_id = pt.id
        AND tr.anio BETWEEN $2 AND $3
      WHERE pt.dependency_id = $1
        AND pt.strategy_id IS NOT NULL
      GROUP BY
        pt.strategy_id, s.name,
        pt.pmd_eje, pt.pmd_tema, pt.pmd_politica_publica,
        pt.pmd_objetivo, pt.pmd_estrategia,
        tr.anio, tr.tipo
      ORDER BY pt.pmd_eje, s.name, tr.anio
    `, [dependency_id, anio_inicio, anio_fin])

    if (rawData.rows.length === 0) {
      return res.json({
        dependency_id, anio_inicio, anio_fin,
        gran_total_programado: 0,
        estrategias: [],
        mensaje: "Sin datos de programado para este período"
      })
    }

    const mapaEstrategias = new Map()

    rawData.rows.forEach(row => {
      const key = row.strategy_id
      if (!mapaEstrategias.has(key)) {
        mapaEstrategias.set(key, {
          strategy_id:          row.strategy_id,
          strategy_nombre:      row.strategy_nombre,
          pmd_eje:              row.pmd_eje              || "",
          pmd_tema:             row.pmd_tema             || "",
          pmd_politica_publica: row.pmd_politica_publica || "",
          pmd_objetivo:         row.pmd_objetivo         || "",
          pmd_estrategia:       row.pmd_estrategia       || "",
          total_lineas:         row.total_lineas         || 0,
          programado_trianual:  0,
          ejecutado_trianual:   0,
          por_anio: {}        
        })
      }

      const est = mapaEstrategias.get(key)

      if (row.anio && !est.por_anio[row.anio]) {
        est.por_anio[row.anio] = { programado: 0, ejecutado: 0 }
      }

      const valor = Number(row.total_valor || 0)
      if (row.anio && row.tipo === "programado") {
        est.programado_trianual += valor
        est.por_anio[row.anio].programado += valor
      }
      if (row.anio && row.tipo === "ejecutado") {
        est.ejecutado_trianual += valor
        if (est.por_anio[row.anio]) {
          est.por_anio[row.anio].ejecutado += valor
        }
      }
    })

    const granTotal = Array.from(mapaEstrategias.values())
      .reduce((s, e) => s + e.programado_trianual, 0)

 
    const estrategias = Array.from(mapaEstrategias.values())
      .filter(e => e.programado_trianual > 0)  
      .map(e => {
        const ponderacion = granTotal > 0
          ? Math.round((e.programado_trianual / granTotal) * 10000) / 100
          : 0

        const porcentaje_cumplimiento = e.programado_trianual > 0
          ? Math.min(
              Math.round((e.ejecutado_trianual / e.programado_trianual) * 10000) / 100,
              100
            )
          : 0

        const avance_ponderado =
          Math.round((porcentaje_cumplimiento / 100) * ponderacion * 100) / 100

        const por_anio_calc = {}
        Object.entries(e.por_anio).forEach(([año, vals]) => {
          const pct_año = vals.programado > 0
            ? Math.min(
                Math.round((vals.ejecutado / vals.programado) * 10000) / 100,
                100
              )
            : 0
          const pond_año = granTotal > 0
            ? Math.round((vals.programado / granTotal) * 10000) / 100
            : 0

          por_anio_calc[año] = {
            programado:             Math.round(vals.programado * 100) / 100,
            ejecutado:              Math.round(vals.ejecutado  * 100) / 100,
            porcentaje_cumplimiento: pct_año,
            ponderacion_anual:      pond_año,
            avance_ponderado_anual: Math.round((pct_año / 100) * pond_año * 100) / 100
          }
        })

        return {
          ...e,
          ponderacion:             ponderacion,
          porcentaje_cumplimiento: porcentaje_cumplimiento,
          avance_ponderado:        avance_ponderado,
          por_anio:                por_anio_calc,
          semaforo:                getSemaforoFicha(porcentaje_cumplimiento)
        }
      })
      .sort((a, b) => b.ponderacion - a.ponderacion)

    const sumaPonderaciones = estrategias.reduce((s, e) => s + e.ponderacion, 0)
    const avancePonderadoGlobal = estrategias.reduce((s, e) => s + e.avance_ponderado, 0)

    res.json({
      dependency_id,
      anio_inicio,
      anio_fin,
      gran_total_programado:   Math.round(granTotal * 100) / 100,
      suma_ponderaciones:      Math.round(sumaPonderaciones * 100) / 100,
      avance_ponderado_global: Math.round(avancePonderadoGlobal * 100) / 100,
      total_estrategias:       estrategias.length,
      semaforo_global:         getSemaforoFicha(avancePonderadoGlobal),
      estrategias
    })
  } catch(e) {
    console.error("Error ponderación estrategia:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.datosEstrategiaParaFicha = async (req, res) => {
  try {
    const { strategy_id, dependency_id } = req.params
    const anio_inicio = parseInt(req.query.anio_inicio) || 2024
    const anio_fin    = parseInt(req.query.anio_fin)    || 2026

    const estRes = await pool.query(`
      SELECT s.*, d.name AS dep_nombre, d.titular, d.enlace
      FROM strategies s
      JOIN dependencies d ON d.id = s.dependency_id
      WHERE s.id = $1
    `, [strategy_id])

    if (!estRes.rows[0]) {
      return res.status(404).json({ error: "Estrategia no encontrada" })
    }
    const estrategia = estRes.rows[0]

    const lineasRes = await pool.query(`
      SELECT pt.id, pt.lineas_accion, pt.pmd_eje, pt.pmd_tema,
        pt.pmd_politica_publica, pt.pmd_objetivo, pt.pmd_estrategia,
        pt.unidad_medida
      FROM planning_templates pt
      WHERE pt.strategy_id = $1 AND pt.dependency_id = $2
      ORDER BY pt.lineas_accion
    `, [strategy_id, dependency_id])

    const lineasIds = lineasRes.rows.map(l => l.id)

    if (lineasIds.length === 0) {
      return res.status(400).json({ error: "Esta estrategia no tiene líneas de acción" })
    }

    const trimRes = await pool.query(`
      SELECT planning_id, anio, trimestre, tipo,
        COALESCE(valor, 0) AS valor
      FROM planning_trimestres
      WHERE planning_id = ANY($1)
        AND anio BETWEEN $2 AND $3
      ORDER BY anio, trimestre, tipo
    `, [lineasIds, anio_inicio, anio_fin])

    const resumen = {}
    for (let a = anio_inicio; a <= anio_fin; a++) {
      resumen[a] = {
        programado: { 1:0, 2:0, 3:0, 4:0 },
        ejecutado:  { 1:0, 2:0, 3:0, 4:0 }
      }
    }

    trimRes.rows.forEach(t => {
      const año = t.anio
      if (resumen[año] && resumen[año][t.tipo] && t.trimestre >= 1 && t.trimestre <= 4) {
        resumen[año][t.tipo][t.trimestre] += Number(t.valor || 0)
      }
    })

    let programado_trianual = 0
    let ejecutado_trianual  = 0
    const por_anio = {}

    Object.entries(resumen).forEach(([año, datos]) => {
      const prog_año = Object.values(datos.programado).reduce((s,v)=>s+v, 0)
      const ejec_año = Object.values(datos.ejecutado ).reduce((s,v)=>s+v, 0)
      programado_trianual += prog_año
      ejecutado_trianual  += ejec_año
      por_anio[año] = { programado: prog_año, ejecutado: ejec_año }
    })

    const totalDepRes = await pool.query(`
      SELECT COALESCE(SUM(tr.valor), 0) AS gran_total
      FROM planning_templates pt
      JOIN planning_trimestres tr ON tr.planning_id = pt.id
      WHERE pt.dependency_id = $1
        AND tr.tipo = 'programado'
        AND tr.anio BETWEEN $2 AND $3
    `, [dependency_id, anio_inicio, anio_fin])

    const granTotal = Number(totalDepRes.rows[0]?.gran_total || 0)

    const ponderacion = granTotal > 0
      ? Math.round((programado_trianual / granTotal) * 10000) / 100
      : 0

    const porcentaje_cumplimiento = programado_trianual > 0
      ? Math.min(
          Math.round((ejecutado_trianual / programado_trianual) * 10000) / 100,
          100
        )
      : 0

    const avance_ponderado =
      Math.round((porcentaje_cumplimiento / 100) * ponderacion * 100) / 100

    const mesesT = {
      1:["enero","febrero","marzo"],
      2:["abril","mayo","junio"],
      3:["julio","agosto","septiembre"],
      4:["octubre","noviembre","diciembre"]
    }
    const calendarizacion = {}
    const anioActual = new Date().getFullYear()
    const datosAnioActual = resumen[anioActual] || resumen[anio_inicio] || {}

    ;[1,2,3,4].forEach(t => {
      const prog = datosAnioActual.programado?.[t] || 0
      const ejec = datosAnioActual.ejecutado?.[t]  || 0
      mesesT[t].forEach(mes => {
        calendarizacion[mes] = {
          programado: Math.round(prog / 3),
          real:       Math.round(ejec / 3)
        }
      })
    })

    const primeraLinea = lineasRes.rows[0] || {}

    res.json({
      nombre_indicador:    `Indicador de cumplimiento: ${estrategia.name}`,
      definicion:          primeraLinea.pmd_objetivo || estrategia.name,
      proposito:           `Medir el avance de la estrategia "${estrategia.name}" durante el período ${anio_inicio}-${anio_fin}`,
      formula:             `(Suma ejecutado trianual / Suma programado trianual) × 100`,
      unidad_medida:       primeraLinea.unidad_medida || "Porcentaje",
      medios_verificacion: "Reportes trimestrales POA / Informes de seguimiento",

      pmd_eje:              primeraLinea.pmd_eje              || "",
      pmd_tema:             primeraLinea.pmd_tema             || "",
      pmd_politica_publica: primeraLinea.pmd_politica_publica || "",
      pmd_objetivo:         primeraLinea.pmd_objetivo         || "",
      pmd_estrategia:       primeraLinea.pmd_estrategia       || "",

      dependency_id,
      dependencia_nombre:   estrategia.dep_nombre,
      responsable:          estrategia.titular  || "",
      correo_electronico:   estrategia.enlace   || "",

      strategy_id,
      strategy_nombre:      estrategia.name,
      anio_inicio, anio_fin,
      total_lineas:         lineasIds.length,
      lineas:               lineasRes.rows,

      anio:                 anioActual,
      anio_base:            anio_inicio - 1,
      valor_anio_base:      0,
      valor_minimo:         0,
      valor_inicial:        Math.round(
        (Object.values(resumen[anio_inicio]?.programado||{}).reduce((s,v)=>s+v,0)) * 100
      ) / 100,
      meta_anual:           Math.round(
        Object.values(resumen[anioActual]?.programado||{}).reduce((s,v)=>s+v,0) * 100
      ) / 100,
      avance_anual:         Math.round(
        Object.values(resumen[anioActual]?.ejecutado||{}).reduce((s,v)=>s+v,0) * 100
      ) / 100,
      meta_trianual:        Math.round(programado_trianual * 100) / 100,

      programado_trianual:  Math.round(programado_trianual * 100) / 100,
      ejecutado_trianual:   Math.round(ejecutado_trianual  * 100) / 100,
      gran_total_dep:       Math.round(granTotal           * 100) / 100,
      ponderacion:          ponderacion,
      porcentaje_cumplimiento: porcentaje_cumplimiento,
      avance_ponderado:     avance_ponderado,
      semaforo:             getSemaforoFicha(porcentaje_cumplimiento),

      por_anio,
      resumen_trimestral:   Object.entries(resumen[anioActual]?.programado||{}).map(([t,v])=>({
        trimestre:   Number(t),
        programado:  v,
        ejecutado:   resumen[anioActual]?.ejecutado?.[t] || 0,
        cumplimiento: v > 0
          ? Math.min(Math.round(((resumen[anioActual]?.ejecutado?.[t]||0)/v)*10000)/100, 100)
          : 0
      })),

      calendarizacion,
    })
  } catch(e) {
    console.error("Error datos estrategia para ficha:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.estrategiasPorDependencia = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT DISTINCT
        s.id           AS strategy_id,
        s.name         AS strategy_nombre,
        pt.pmd_eje,
        pt.pmd_tema,
        pt.pmd_politica_publica,
        pt.pmd_objetivo,
        pt.pmd_estrategia,
        COUNT(pt.id)::int AS total_lineas
      FROM strategies s
      JOIN planning_templates pt ON pt.strategy_id = s.id
      WHERE pt.dependency_id = $1
      GROUP BY s.id, s.name, pt.pmd_eje, pt.pmd_tema,
        pt.pmd_politica_publica, pt.pmd_objetivo, pt.pmd_estrategia
      ORDER BY pt.pmd_eje, s.name
    `, [req.params.dependency_id])

    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

const getSemaforoFicha = (pct) => {
  const p = Number(pct)
  if (p >= 90) return { color:"#16a34a", bg:"#d1fae5", label:"Óptimo",  emoji:"🟢" }
  if (p >= 70) return { color:"#d97706", bg:"#fef3c7", label:"Bueno",   emoji:"🟡" }
  if (p >= 50) return { color:"#f59e0b", bg:"#fffbeb", label:"Regular", emoji:"🟠" }
  return        { color:"#dc2626", bg:"#fee2e2", label:"Bajo",    emoji:"🔴" }
}