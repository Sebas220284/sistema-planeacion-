const pool = require("../../../database/postgres")

const ROLES_TODAS = ["admin", "planeacion", "planeacion_estrategica"]
const ROLES_VALIDACION = ["admin", "planeacion", "planeacion_estrategica"] 
const ROL_DEPENDENCIA = "dependencias"

async function contextoUsuario(req) {
  const id = req.user?.id || req.user?.userId || req.user?.sub
  if (!id) return null
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.dependency_id, u.dependency_position, r.name AS rol
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`, [id])
  return rows[0] || null
}
const veTodo = (u) => u.rol !== ROL_DEPENDENCIA
const esMisma = (u, dep) => !!u.dependency_id && u.dependency_id === dep


const TEXTO = [
  "nombre", "clave_programatica", "modalidad_programatica", "unidad_responsable", "area_ejecutora",
  "unidades_responsables_participantes", "instrumento_diseno", "isd",
  "responsable_integracion", "cargo", "correo_institucional", "telefono_institucional",
  "eje_rector", "eje_transversal", "politica_publica", "objetivo_estrategico", "estrategia", "linea_accion", "ods",
  "instrumento_nacional_planeacion", "instrumento_estatal_planeacion",
  "objetivo_institucional", "resultado_esperado", "contribucion_programa",
  "problematica_publica", "poblacion_area_afectada", "ubicacion_territorial", "magnitud_unidad_medida",
  "diagnostico_general", "justificacion_intervencion", "antecedentes", "causas_preliminares", "efectos_preliminares",
  "problema_central", "objetivo_central",
  "alternativa_seleccionada", "justificacion_tecnica",
  "objetivo_general", "poblacion_referencia", "poblacion_potencial", "poblacion_objetivo", "poblacion_atendida_estimada",
  "beneficiarios", "area_enfoque", "caracterizacion_poblacion", "metodo_cuantificacion", "fuente_informacion",
  "cobertura_territorial", "cobertura_poblacional", "cobertura_temporal", "cobertura_operativa", "referencia_geografica",
  "municipio", "localidades_beneficiadas", "colonias_beneficiadas", "cobertura_urbana", "cobertura_rural",
  "supuesto_estrategico", "supuesto_operativo", "supuesto_financiero", "supuesto_externo",
  "tipo_gasto", "calendarizacion", "necesidades_gasto_corto_plazo", "necesidades_gasto_mediano_plazo",
]
const ARREGLOS = [
  "fuentes_diagnostico",
  "efectos_indirectos", "efectos_directos", "causas_directas", "causas_indirectas",
  "fines_indirectos", "fines_directos", "medios_directos", "medios_indirectos",
  "capitulos_gasto", "fuentes_financiamiento",
]
const NUMEROS = ["magnitud", "presupuesto_total", "anio_periodo_diagnostico"]
const BOOL = ["usa_mir", "usa_fime", "usa_fiseg"]
const OTROS = ["strategy_id", "ejercicio_fiscal", "fecha_elaboracion", "planning_template_id"]
const VINCULADOS = ["eje_rector", "politica_publica", "objetivo_estrategico", "estrategia", "linea_accion", "ods", "strategy_id"]

const TIPO_GASTO = ["Corriente", "Inversión", "Mixto"]
const NIVELES = ["fin", "proposito", "componente", "actividad"]
const RESULTADOS = ["Procedente", "Procedente con observaciones", "No procedente"]
const RESULTADO_A_ESTATUS = { "Procedente": "validado", "Procedente con observaciones": "en_revision", "No procedente": "rechazado" }
const RESPONSABILIDADES = ["Elaboró", "Revisó", "Validó"]

const vacio = (v) => {
  if (v === undefined) return undefined
  if (v === null) return null
  if (typeof v === "string") { const t = v.trim(); return t === "" ? null : t }
  return v
}
const lista = (v) => (Array.isArray(v) ? v : String(v ?? "").split("\n"))
  .map((x) => String(x ?? "").trim()).filter(Boolean)
const num = (v) => {
  const x = vacio(v)
  if (x === undefined || x === null) return x
  const n = Number(String(x).replace(/[$,\s]/g, ""))
  return Number.isFinite(n) ? n : NaN
}
const califica = (v) => { const n = vacio(v); return n == null ? null : Number(n) }
const bool = (v) => v === true || v === "true" || v === 1 || v === "1"

function extraerCampos(b) {
  const o = {}
  for (const c of TEXTO) if (c in b) o[c] = vacio(b[c])
  for (const c of ARREGLOS) if (c in b) o[c] = lista(b[c])
  for (const c of NUMEROS) if (c in b) o[c] = num(b[c])
  for (const c of BOOL) if (c in b) o[c] = bool(b[c])
  for (const c of OTROS) if (c in b) o[c] = vacio(b[c])
  return o
}


function extraerHijos(b) {
  const h = {}
  const arr = (x) => (Array.isArray(x) ? x : null)

  if (arr(b.programas_derivados)) {
    h.programas_derivados = b.programas_derivados
      .map((r) => ({ programa: vacio(r.programa), objetivo_vinculado: vacio(r.objetivo_vinculado), contribucion: vacio(r.contribucion) }))
      .filter((r) => r.programa)
  }
  if (arr(b.objetivos_especificos)) {
    h.objetivos_especificos = b.objetivos_especificos
      .map((r) => (typeof r === "string" ? vacio(r) : vacio(r?.objetivo))).filter(Boolean)
  }
  if (arr(b.bienes_servicios)) {
    h.bienes_servicios = b.bienes_servicios
      .map((r) => ({ bien_servicio: vacio(r.bien_servicio), tipo: vacio(r.tipo), descripcion: vacio(r.descripcion),
        poblacion_receptora: vacio(r.poblacion_receptora), unidad_medida: vacio(r.unidad_medida), evidencia: vacio(r.evidencia) }))
      .filter((r) => r.bien_servicio)
  }
  if (arr(b.alternativas)) {
    h.alternativas = b.alternativas
      .map((r) => ({ alternativa: vacio(r.alternativa), tecnica: califica(r.tecnica), financiera: califica(r.financiera),
        operativa: califica(r.operativa), juridica: califica(r.juridica), social: califica(r.social), seleccionada: bool(r.seleccionada) }))
      .filter((r) => r.alternativa)
  }
  if (arr(b.indicadores_registro)) {
    h.indicadores_registro = b.indicadores_registro
      .map((r) => ({
        nombre_indicador: vacio(r.nombre_indicador), nivel_vinculado: vacio(r.nivel_vinculado),
        unidad_responsable: vacio(r.unidad_responsable), definicion: vacio(r.definicion), tipo: vacio(r.tipo),
        dimension: vacio(r.dimension), metodo_calculo: vacio(r.metodo_calculo), variables: vacio(r.variables),
        unidad_medida: vacio(r.unidad_medida), frecuencia: vacio(r.frecuencia), sentido: vacio(r.sentido),
        linea_base: vacio(r.linea_base == null ? r.linea_base : String(r.linea_base)),
        meta: vacio(r.meta == null ? r.meta : String(r.meta)),
        semaforizacion: vacio(r.semaforizacion), medios_verificacion: vacio(r.medios_verificacion),
        cremaa_claro: bool(r.cremaa_claro), cremaa_relevante: bool(r.cremaa_relevante), cremaa_economico: bool(r.cremaa_economico),
        cremaa_monitoreable: bool(r.cremaa_monitoreable), cremaa_adecuado: bool(r.cremaa_adecuado),
        cremaa_aportacion_marginal: bool(r.cremaa_aportacion_marginal), observaciones_cremaa: vacio(r.observaciones_cremaa),
      })).filter((r) => r.nombre_indicador)
  }
  if (arr(b.mir)) {
    h.mir = b.mir
      .map((r) => ({
        nivel: vacio(r.nivel), clave: vacio(r.clave == null ? r.clave : String(r.clave)),
        resumen_narrativo: vacio(r.resumen_narrativo),
        indicador_numeros: (Array.isArray(r.indicador_numeros) ? r.indicador_numeros : []).map(Number).filter(Number.isInteger),
        medios_verificacion: vacio(r.medios_verificacion), supuestos: vacio(r.supuestos),
      })).filter((r) => r.resumen_narrativo)
  }
  if (arr(b.metas_resultados)) {
    h.metas_resultados = b.metas_resultados
      .map((r) => ({ indicador_numero: Number(r.indicador_numero), periodo: vacio(r.periodo), meta: vacio(r.meta == null ? r.meta : String(r.meta)),
        resultado: vacio(r.resultado) || "Pendiente", cumplimiento: vacio(r.cumplimiento) || "Pendiente",
        estatus: vacio(r.estatus) || "Programado", observaciones: vacio(r.observaciones) }))
      .filter((r) => Number.isInteger(r.indicador_numero))
  }
  if (arr(b.acciones_mejora)) {
    h.acciones_mejora = b.acciones_mejora
      .map((r) => ({ accion: vacio(r.accion), unidad_responsable: vacio(r.unidad_responsable), fecha_inicio: vacio(r.fecha_inicio),
        fecha_conclusion: vacio(r.fecha_conclusion), resultado_esperado: vacio(r.resultado_esperado),
        seguimiento: vacio(r.seguimiento), estatus: vacio(r.estatus) || "Programada" }))
      .filter((r) => r.accion)
  }
  return h
}

function validar(campos, h) {
  const e = []
  if ("nombre" in campos && !campos.nombre) e.push("El nombre no puede quedar vacío.")
  for (const c of NUMEROS) if (campos[c] !== undefined && campos[c] !== null && Number.isNaN(campos[c])) e.push(`El campo ${c} debe ser numérico.`)
  if (campos.presupuesto_total != null && campos.presupuesto_total < 0) e.push("El presupuesto total no puede ser negativo.")
  if (campos.magnitud != null && campos.magnitud < 0) e.push("La magnitud no puede ser negativa.")
  if (campos.anio_periodo_diagnostico != null && (!Number.isInteger(campos.anio_periodo_diagnostico) || campos.anio_periodo_diagnostico < 2000 || campos.anio_periodo_diagnostico > 2100)) e.push("Año o periodo del diagnóstico inválido.")
  if (campos.tipo_gasto && !TIPO_GASTO.includes(campos.tipo_gasto)) e.push(`Tipo de gasto inválido. Usa: ${TIPO_GASTO.join(", ")}.`)
  if (campos.correo_institucional && !/^\S+@\S+\.\S+$/.test(campos.correo_institucional)) e.push("El correo institucional no tiene formato válido.")

  if (h.objetivos_especificos?.length > 5) e.push("Máximo 5 objetivos específicos.")
  if (h.bienes_servicios?.length > 5) e.push("Máximo 5 bienes o servicios.")
  for (const b of h.bienes_servicios || []) if (b.tipo && !["Bien", "Servicio"].includes(b.tipo)) e.push(`Tipo inválido en "${b.bien_servicio}". Usa Bien o Servicio.`)

  if (h.alternativas) {
    if (h.alternativas.filter((a) => a.seleccionada).length > 1) e.push("Solo una alternativa puede estar seleccionada.")
    for (const a of h.alternativas) for (const k of ["tecnica", "financiera", "operativa", "juridica", "social"]) {
      if (a[k] != null && ![1, 2, 3].includes(a[k])) e.push(`La calificación ${k} de "${a.alternativa}" debe ser 1 (Baja), 2 (Media) o 3 (Alta).`)
    }
  }
  if (h.indicadores_registro) {
    for (const i of h.indicadores_registro) {
      if (i.tipo && !["Estratégico", "Gestión"].includes(i.tipo)) e.push(`Tipo inválido en indicador "${i.nombre_indicador}". Usa Estratégico o Gestión.`)
      if (i.dimension && !["Eficacia", "Eficiencia", "Calidad", "Economía"].includes(i.dimension)) e.push(`Dimensión inválida en indicador "${i.nombre_indicador}".`)
    }
  }
  if (h.mir) {
    const vistos = new Set()
    for (const r of h.mir) {
      if (!NIVELES.includes(r.nivel)) { e.push(`Nivel MIR inválido: "${r.nivel}".`); continue }
      if (r.nivel === "fin" || r.nivel === "proposito") r.clave = null
      else if (r.nivel === "componente" && !/^\d+$/.test(r.clave || "")) e.push(`El componente "${r.resumen_narrativo.slice(0, 30)}" necesita clave numérica (1, 2, 3…).`)
      else if (r.nivel === "actividad" && !/^\d+\.\d+$/.test(r.clave || "")) e.push(`La actividad "${r.resumen_narrativo.slice(0, 30)}" necesita clave tipo 1.1, 1.2…`)
      const k = `${r.nivel}|${r.clave || ""}`
      if (vistos.has(k)) e.push(`MIR duplicada: ${r.nivel} ${r.clave || ""}.`)
      vistos.add(k)
    }
    if (h.mir.filter((r) => r.nivel === "fin").length > 1) e.push("La MIR solo puede tener un Fin.")
    if (h.mir.filter((r) => r.nivel === "proposito").length > 1) e.push("La MIR solo puede tener un Propósito.")
    for (const r of h.mir) if (r.nivel === "actividad" && r.clave && !h.mir.some((c) => c.nivel === "componente" && c.clave === r.clave.split(".")[0])) {
      e.push(`La actividad ${r.clave} no tiene su componente ${r.clave.split(".")[0]}.`)
    }
  }
  for (const a of h.acciones_mejora || []) {
    if (a.fecha_inicio && a.fecha_conclusion && a.fecha_conclusion < a.fecha_inicio) e.push(`La acción "${a.accion.slice(0, 30)}" termina antes de iniciar.`)
  }
  return e
}

async function guardarHijos(client, id, h) {
  const reemplazar = async (tabla) => client.query(`DELETE FROM ${tabla} WHERE programa_id = $1`, [id])

  if (h.programas_derivados) {
    await reemplazar("pp_programas_derivados")
    for (let i = 0; i < h.programas_derivados.length; i++) {
      const r = h.programas_derivados[i]
      await client.query(`INSERT INTO pp_programas_derivados (programa_id, orden, programa, objetivo_vinculado, contribucion) VALUES ($1,$2,$3,$4,$5)`,
        [id, i + 1, r.programa, r.objetivo_vinculado, r.contribucion])
    }
  }
  if (h.objetivos_especificos) {
    await reemplazar("pp_objetivos_especificos")
    for (let i = 0; i < h.objetivos_especificos.length; i++)
      await client.query(`INSERT INTO pp_objetivos_especificos (programa_id, numero, objetivo) VALUES ($1,$2,$3)`, [id, i + 1, h.objetivos_especificos[i]])
  }
  if (h.bienes_servicios) {
    await reemplazar("pp_bienes_servicios")
    for (let i = 0; i < h.bienes_servicios.length; i++) {
      const r = h.bienes_servicios[i]
      await client.query(`INSERT INTO pp_bienes_servicios (programa_id, numero, bien_servicio, tipo, descripcion, poblacion_receptora, unidad_medida, evidencia)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, i + 1, r.bien_servicio, r.tipo, r.descripcion, r.poblacion_receptora, r.unidad_medida, r.evidencia])
    }
  }
  if (h.alternativas) {
    await reemplazar("pp_alternativas")
    for (let i = 0; i < h.alternativas.length; i++) {
      const r = h.alternativas[i]
      await client.query(`INSERT INTO pp_alternativas (programa_id, orden, alternativa, tecnica, financiera, operativa, juridica, social, seleccionada)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, i + 1, r.alternativa, r.tecnica, r.financiera, r.operativa, r.juridica, r.social, r.seleccionada])
    }
  }
  if (h.indicadores_registro) {
    await reemplazar("pp_indicadores_registro")
    for (let i = 0; i < h.indicadores_registro.length; i++) {
      const r = h.indicadores_registro[i]
      await client.query(`INSERT INTO pp_indicadores_registro
        (programa_id, numero, nombre_indicador, nivel_vinculado, unidad_responsable, definicion, tipo, dimension, metodo_calculo, variables,
         unidad_medida, frecuencia, sentido, linea_base, meta, semaforizacion, medios_verificacion,
         cremaa_claro, cremaa_relevante, cremaa_economico, cremaa_monitoreable, cremaa_adecuado, cremaa_aportacion_marginal, observaciones_cremaa)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
        [id, i + 1, r.nombre_indicador, r.nivel_vinculado, r.unidad_responsable, r.definicion, r.tipo, r.dimension, r.metodo_calculo, r.variables,
         r.unidad_medida, r.frecuencia, r.sentido, r.linea_base, r.meta, r.semaforizacion, r.medios_verificacion,
         r.cremaa_claro, r.cremaa_relevante, r.cremaa_economico, r.cremaa_monitoreable, r.cremaa_adecuado, r.cremaa_aportacion_marginal, r.observaciones_cremaa])
    }
  }
  if (h.mir) {
    await reemplazar("pp_mir_filas")
    for (let i = 0; i < h.mir.length; i++) {
      const r = h.mir[i]
      await client.query(`INSERT INTO pp_mir_filas (programa_id, nivel, clave, orden, resumen_narrativo, indicador_numeros, medios_verificacion, supuestos)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, r.nivel, r.clave, i + 1, r.resumen_narrativo, r.indicador_numeros, r.medios_verificacion, r.supuestos])
    }
  }
  if (h.metas_resultados) {
    await reemplazar("pp_metas_resultados")
    for (let i = 0; i < h.metas_resultados.length; i++) {
      const r = h.metas_resultados[i]
      await client.query(`INSERT INTO pp_metas_resultados (programa_id, orden, indicador_numero, periodo, meta, resultado, cumplimiento, estatus, observaciones)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, i + 1, r.indicador_numero, r.periodo, r.meta, r.resultado, r.cumplimiento, r.estatus, r.observaciones])
    }
  }
  if (h.acciones_mejora) {
    await reemplazar("pp_acciones_mejora")
    for (let i = 0; i < h.acciones_mejora.length; i++) {
      const r = h.acciones_mejora[i]
      await client.query(`INSERT INTO pp_acciones_mejora (programa_id, orden, accion, unidad_responsable, fecha_inicio, fecha_conclusion, resultado_esperado, seguimiento, estatus)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [id, i + 1, r.accion, r.unidad_responsable, r.fecha_inicio, r.fecha_conclusion, r.resultado_esperado, r.seguimiento, r.estatus])
    }
  }
}


async function vinculacionDeLinea(planningId) {
  const { rows } = await pool.query(
    `SELECT to_jsonb(pt) AS pt, s.name AS estrategia_nombre, d.name AS dependencia
       FROM planning_templates pt
       LEFT JOIN strategies s   ON s.id = pt.strategy_id
       LEFT JOIN dependencies d ON d.id = pt.dependency_id
      WHERE pt.id = $1`, [planningId])
  if (!rows[0]) return null
  const p = rows[0].pt
  return {
    planning_template_id: p.id,
    strategy_id: p.strategy_id || null,
    dependency_id: p.dependency_id || null,
    dependencia: rows[0].dependencia || null,
    nomenclatura: p.nomenclatura || null,
    eje_rector: p.pmd_eje || null,
    tema: p.pmd_tema || null,
    politica_publica: p.pmd_politica_publica || null,
    objetivo_estrategico: p.pmd_objetivo || null,
    estrategia: p.pmd_estrategia || rows[0].estrategia_nombre || null,
    linea_accion: p.lineas_accion || null,
    ods: p.ods || null, 
  }
}

exports.vinculacion = async (req, res) => {
  try {
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })
    if (!req.query.planning_template_id) return res.status(400).json({ error: "Indica planning_template_id." })
    const v = await vinculacionDeLinea(req.query.planning_template_id)
    if (!v) return res.status(404).json({ error: "Línea de acción no encontrada." })
    if (!veTodo(u) && v.dependency_id !== u.dependency_id) return res.status(403).json({ error: "Esa línea de acción es de otra dependencia." })
    res.json(v)
  } catch (e) {
    if (e.code === "22P02") return res.status(400).json({ error: "Identificador inválido." })
    console.error("[PP-FICHA] vinculacion:", e)
    res.status(500).json({ error: "No se pudo obtener la vinculación estratégica." })
  }
}

exports.lineasDisponibles = async (req, res) => {
  try {
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })
    const params = []
    const where = []
    const dep = veTodo(u) ? req.query.dependency_id : u.dependency_id
    if (!veTodo(u) && !dep) return res.json([])
    if (dep) { params.push(dep); where.push(`pt.dependency_id = $${params.length}`) }
    if (req.query.q) { params.push(`%${String(req.query.q).trim()}%`); where.push(`(pt.nomenclatura ILIKE $${params.length} OR pt.lineas_accion ILIKE $${params.length})`) }
    const { rows } = await pool.query(
      `SELECT pt.id, pt.nomenclatura, pt.lineas_accion, pt.pmd_eje, pt.pmd_estrategia, pt.dependency_id
         FROM planning_templates pt ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY pt.nomenclatura LIMIT 200`, params)
    res.json(rows)
  } catch (e) {
    console.error("[PP-FICHA] lineas:", e)
    res.status(500).json({ error: "No se pudieron obtener las líneas de acción." })
  }
}

async function cargarFicha(id) {
  const { rows } = await pool.query(
    `SELECT pp.*, d.name AS dependencia FROM programas_presupuestarios pp
       JOIN dependencies d ON d.id = pp.dependency_id WHERE pp.id = $1`, [id])
  if (!rows[0]) return null
  const q = (sql) => pool.query(sql, [id]).then((r) => r.rows)
  const [der, obj, bys, alt, ind, mir, met, acc, val, resp, prelim] = await Promise.all([
    q("SELECT programa, objetivo_vinculado, contribucion FROM pp_programas_derivados WHERE programa_id=$1 ORDER BY orden"),
    q("SELECT numero, objetivo FROM pp_objetivos_especificos WHERE programa_id=$1 ORDER BY numero"),
    q("SELECT numero, bien_servicio, tipo, descripcion, poblacion_receptora, unidad_medida, evidencia FROM pp_bienes_servicios WHERE programa_id=$1 ORDER BY numero"),
    q("SELECT alternativa, tecnica, financiera, operativa, juridica, social, seleccionada FROM pp_alternativas WHERE programa_id=$1 ORDER BY orden"),
    q("SELECT * FROM pp_indicadores_registro WHERE programa_id=$1 ORDER BY numero"),
    q("SELECT nivel, clave, resumen_narrativo, indicador_numeros, medios_verificacion, supuestos FROM pp_mir_filas WHERE programa_id=$1 ORDER BY orden"),
    q("SELECT indicador_numero, periodo, meta, resultado, cumplimiento, estatus, observaciones FROM pp_metas_resultados WHERE programa_id=$1 ORDER BY orden"),
    q("SELECT accion, unidad_responsable, fecha_inicio, fecha_conclusion, resultado_esperado, seguimiento, estatus FROM pp_acciones_mejora WHERE programa_id=$1 ORDER BY orden"),
    q(`SELECT v.resultado_validacion, v.observaciones_generales, v.updated_at, u.name AS validado_por_nombre
         FROM pp_validacion v LEFT JOIN users u ON u.id = v.validado_por WHERE v.programa_id=$1`),
    q("SELECT responsabilidad, nombre_cargo, unidad_responsable, fecha FROM pp_responsables WHERE programa_id=$1"),
    q("SELECT nombre_indicador, dimension, frecuencia, meta_anual, medio_verificacion FROM pp_indicadores_preliminares WHERE programa_id=$1 ORDER BY orden"),
  ])
  const vinculacion = rows[0].planning_template_id ? await vinculacionDeLinea(rows[0].planning_template_id) : null

  const estructura = mir.filter((r) => r.nivel === "componente").map((c) => ({
    componente: c.clave, descripcion: c.resumen_narrativo,
    actividades: mir.filter((a) => a.nivel === "actividad" && a.clave.startsWith(c.clave + ".")).map((a) => ({ clave: a.clave, descripcion: a.resumen_narrativo })),
  }))

  const orden = Object.fromEntries(RESPONSABILIDADES.map((r, i) => [r, i]))
  return {
    ...rows[0],
    vinculacion,
    programas_derivados: der, objetivos_especificos: obj, bienes_servicios: bys,
    alternativas: alt, indicadores_registro: ind, mir, estructura_analitica: estructura,
    metas_resultados: met, acciones_mejora: acc,
    indicadores_preliminares: prelim,
    validacion: { ...(val[0] || { resultado_validacion: null, observaciones_generales: null }),
      responsables: resp.sort((a, b) => orden[a.responsabilidad] - orden[b.responsabilidad]) },
  }
}

exports.obtenerFicha = async (req, res) => {
  try {
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })
    const f = await cargarFicha(req.params.id)
    if (!f) return res.status(404).json({ error: "Programa presupuestario no encontrado." })
    if (!veTodo(u) && !esMisma(u, f.dependency_id)) return res.status(403).json({ error: "No tienes acceso a este programa." })
    res.json(f)
  } catch (e) {
    if (e.code === "22P02") return res.status(400).json({ error: "Identificador inválido." })
    console.error("[PP-FICHA] obtener:", e)
    res.status(500).json({ error: "No se pudo obtener la ficha." })
  }
}


exports.guardarFicha = async (req, res) => {
  const client = await pool.connect()
  try {
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })
    const esDep = u.rol === ROL_DEPENDENCIA
    if (!esDep && !ROLES_TODAS.includes(u.rol)) return res.status(403).json({ error: "Tu rol no puede editar programas presupuestarios." })

    const act = await pool.query("SELECT dependency_id, estatus FROM programas_presupuestarios WHERE id=$1", [req.params.id])
    if (!act.rows[0]) return res.status(404).json({ error: "Programa presupuestario no encontrado." })
    if (esDep && !esMisma(u, act.rows[0].dependency_id)) return res.status(403).json({ error: "Solo puedes editar programas de tu dependencia." })
    if (esDep && act.rows[0].estatus === "validado") return res.status(409).json({ error: "El programa ya está validado; solo Planeación puede modificarlo." })

    const body = req.body || {}
    const campos = extraerCampos(body)
    const hijos = extraerHijos(body)

    if ("planning_template_id" in campos) {
      if (campos.planning_template_id) {
        const v = await vinculacionDeLinea(campos.planning_template_id)
        if (!v) return res.status(400).json({ error: "La línea de acción indicada no existe." })
        if (esDep && v.dependency_id !== u.dependency_id) return res.status(403).json({ error: "Esa línea de acción es de otra dependencia." })
        for (const k of VINCULADOS) campos[k] = v[k] ?? null
      } else {
        for (const k of VINCULADOS) delete campos[k]
      }
    } else if (act.rows[0] && VINCULADOS.some((k) => k in campos)) {
      const ya = await pool.query("SELECT planning_template_id FROM programas_presupuestarios WHERE id=$1", [req.params.id])
      if (ya.rows[0].planning_template_id) for (const k of VINCULADOS) delete campos[k]
    }
    if (esDep) { delete campos.ejercicio_fiscal }

    const errores = validar(campos, hijos)
    if (hijos.mir || hijos.metas_resultados) {
      const cantidad = hijos.indicadores_registro
        ? hijos.indicadores_registro.length
        : (await pool.query("SELECT COUNT(*)::int n FROM pp_indicadores_registro WHERE programa_id=$1", [req.params.id])).rows[0].n
      for (const r of hijos.mir || []) for (const n of r.indicador_numeros) if (n < 1 || n > cantidad) errores.push(`La MIR apunta al indicador ${n}, que no existe.`)
      for (const r of hijos.metas_resultados || []) if (r.indicador_numero < 1 || r.indicador_numero > cantidad) errores.push(`Metas y resultados apunta al indicador ${r.indicador_numero}, que no existe.`)
    }
    if (errores.length) return res.status(400).json({ error: errores[0], errores })

    await client.query("BEGIN")
    const cols = Object.keys(campos)
    const vals = cols.map((c) => campos[c])
    const sets = cols.map((c, i) => `${c} = $${i + 1}`)
    sets.push(`updated_by = $${vals.length + 1}`, "updated_at = NOW()")
    vals.push(u.id, req.params.id)
    await client.query(`UPDATE programas_presupuestarios SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals)
    await guardarHijos(client, req.params.id, hijos)
    await client.query("COMMIT")

    res.json(await cargarFicha(req.params.id))
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {})
    if (["22P02", "22007", "22008", "22003"].includes(e.code)) return res.status(400).json({ error: "Dato con formato inválido (fecha, número o identificador)." })
    if (e.code === "23505") return res.status(409).json({ error: "Dato duplicado (nombre o clave programática repetidos, o MIR/alternativa duplicada)." })
    if (e.code === "23503") return res.status(400).json({ error: "La línea de acción o la estrategia indicada no existe." })
    if (e.code === "23514") return res.status(400).json({ error: "Algún valor no cumple las reglas de la ficha (calificaciones 1–3, fechas, montos)." })
    console.error("[PP-FICHA] guardar:", e)
    res.status(500).json({ error: "No se pudo guardar la ficha." })
  } finally {
    client.release()
  }
}

exports.obtenerValidacion = async (req, res) => {
  try {
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })
    const p = await pool.query("SELECT dependency_id, estatus FROM programas_presupuestarios WHERE id=$1", [req.params.id])
    if (!p.rows[0]) return res.status(404).json({ error: "Programa presupuestario no encontrado." })
    if (!veTodo(u) && !esMisma(u, p.rows[0].dependency_id)) return res.status(403).json({ error: "No tienes acceso a este programa." })
    const f = await cargarFicha(req.params.id)
    res.json({ estatus: f.estatus, ...f.validacion, puede_editar: ROLES_VALIDACION.includes(u.rol) })
  } catch (e) {
    if (e.code === "22P02") return res.status(400).json({ error: "Identificador inválido." })
    console.error("[PP-FICHA] obtenerValidacion:", e)
    res.status(500).json({ error: "No se pudo obtener la validación." })
  }
}

exports.guardarValidacion = async (req, res) => {
  const client = await pool.connect()
  try {
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })
    if (!ROLES_VALIDACION.includes(u.rol)) return res.status(403).json({ error: "Solo Planeación Estratégica puede capturar la validación." })

    const p = await pool.query("SELECT id FROM programas_presupuestarios WHERE id=$1", [req.params.id])
    if (!p.rows[0]) return res.status(404).json({ error: "Programa presupuestario no encontrado." })

    const b = req.body || {}
    const resultado = vacio(b.resultado_validacion)
    if (resultado && !RESULTADOS.includes(resultado)) return res.status(400).json({ error: `Resultado inválido. Usa: ${RESULTADOS.join(", ")}.` })

    const resp = Array.isArray(b.responsables) ? b.responsables : null
    if (resp) {
      for (const r of resp) if (!RESPONSABILIDADES.includes(r.responsabilidad)) return res.status(400).json({ error: `Responsabilidad inválida. Usa: ${RESPONSABILIDADES.join(", ")}.` })
      if (new Set(resp.map((r) => r.responsabilidad)).size !== resp.length) return res.status(400).json({ error: "Cada responsabilidad (Elaboró, Revisó, Validó) solo puede aparecer una vez." })
    }
    if (resultado === "No procedente" && !vacio(b.observaciones_generales)) {
      return res.status(400).json({ error: "Si el programa no es procedente, indica las observaciones generales." })
    }

    await client.query("BEGIN")
    await client.query(
      `INSERT INTO pp_validacion (programa_id, resultado_validacion, observaciones_generales, validado_por, updated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (programa_id) DO UPDATE SET
         resultado_validacion = CASE WHEN $5 THEN EXCLUDED.resultado_validacion ELSE pp_validacion.resultado_validacion END,
         observaciones_generales = CASE WHEN $6 THEN EXCLUDED.observaciones_generales ELSE pp_validacion.observaciones_generales END,
         validado_por = EXCLUDED.validado_por, updated_at = NOW()`,
      [req.params.id, resultado ?? null, vacio(b.observaciones_generales) ?? null, u.id,
       "resultado_validacion" in b, "observaciones_generales" in b])

    if (resp) {
      await client.query("DELETE FROM pp_responsables WHERE programa_id=$1", [req.params.id])
      for (const r of resp) {
        const nombre = vacio(r.nombre_cargo)
        if (!nombre) continue
        await client.query(`INSERT INTO pp_responsables (programa_id, responsabilidad, nombre_cargo, unidad_responsable, fecha) VALUES ($1,$2,$3,$4,$5)`,
          [req.params.id, r.responsabilidad, nombre, vacio(r.unidad_responsable), vacio(r.fecha)])
      }
    }
    if (resultado) {
      await client.query("UPDATE programas_presupuestarios SET estatus=$1, updated_by=$2, updated_at=NOW() WHERE id=$3",
        [RESULTADO_A_ESTATUS[resultado], u.id, req.params.id])
    }
    await client.query("COMMIT")
    const f = await cargarFicha(req.params.id)
    res.json({ estatus: f.estatus, ...f.validacion })
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {})
    if (["22P02", "22007", "22008"].includes(e.code)) return res.status(400).json({ error: "Dato con formato inválido (revisa la fecha) o identificador incorrecto." })
    console.error("[PP-FICHA] guardarValidacion:", e)
    res.status(500).json({ error: "No se pudo guardar la validación." })
  } finally {
    client.release()
  }
}