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
