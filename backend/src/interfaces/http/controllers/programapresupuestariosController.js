const pool = require("../../../database/postgres")

const ROLES_TODAS = ["admin", "planeacion", "planeacion_estrategica"]
const ROLES_VALIDACION = ["admin", "planeacion", "planeacion_estrategica"] 
const ROL_DEPENDENCIA = "dependencias"

// Roles usados por el CRUD (listar/crear/actualizar/eliminar) que consume el frontend actual
const ROLES_TODAS_DEPENDENCIAS = ["admin", "planeacion", "planeacion_estrategica"] // editan cualquier programa
const ROLES_DEPENDENCIA = [ROL_DEPENDENCIA]

// Asegura que exista la tabla pp_identificacion_general y las columnas instrumento_diseno e isd.
let _columnasAseguradas = null
function asegurarColumnas() {
  if (!_columnasAseguradas) {
    _columnasAseguradas = pool
      .query(
        `ALTER TABLE programas_presupuestarios
           ADD COLUMN IF NOT EXISTS instrumento_diseno TEXT,
           ADD COLUMN IF NOT EXISTS isd VARCHAR(10);

         CREATE TABLE IF NOT EXISTS pp_identificacion_general (
           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
           programa_id UUID UNIQUE REFERENCES programas_presupuestarios(id) ON DELETE CASCADE,
           nombre TEXT NOT NULL,
           clave_programatica TEXT,
           modalidad_programatica TEXT,
           dependency_id UUID NOT NULL REFERENCES dependencies(id) ON DELETE RESTRICT,
           unidad_responsable TEXT,
           area_ejecutora TEXT,
           ejercicio_fiscal INTEGER NOT NULL CHECK (ejercicio_fiscal BETWEEN 2024 AND 2100),
           fecha_elaboracion DATE,
           responsable_integracion TEXT,
           cargo TEXT,
           correo_institucional TEXT,
           telefono_institucional TEXT,
           instrumento_diseno TEXT,
           isd VARCHAR(10),
           estatus TEXT NOT NULL DEFAULT 'borrador' CHECK (estatus IN ('borrador', 'en_revision', 'validado', 'rechazado')),
           created_by UUID REFERENCES users(id),
           updated_by UUID REFERENCES users(id),
           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         );

         CREATE TABLE IF NOT EXISTS pp_vinculacion_estrategica (
           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
           programa_id UUID UNIQUE NOT NULL REFERENCES programas_presupuestarios(id) ON DELETE CASCADE,
           planning_template_id UUID REFERENCES planning_templates(id) ON DELETE SET NULL,
           strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
           eje_rector TEXT,
           eje_transversal TEXT,
           politica_publica TEXT,
           objetivo_estrategico TEXT,
           estrategia TEXT,
           linea_accion TEXT,
           ods TEXT,
           instrumento_pnd TEXT,
           instrumento_ped TEXT,
           programa_derivado TEXT,
           objetivo_vinculado TEXT,
           contribucion TEXT,
           created_by UUID REFERENCES users(id),
           updated_by UUID REFERENCES users(id),
           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         );

         CREATE TABLE IF NOT EXISTS pp_problema_publico (
           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
           programa_id UUID UNIQUE NOT NULL REFERENCES programas_presupuestarios(id) ON DELETE CASCADE,
           problema_publico_d TEXT,
           poblacion_afectada TEXT,
           ubicacion_territorial TEXT,
           magnitud NUMERIC,
           unidad_medida TEXT,
           fuentes_informacion TEXT,
           periodo VARCHAR(50),
           antecedentes TEXT,
           causas_preliminares TEXT,
           efectos_preliminares TEXT,
           justificacion TEXT,
           created_by UUID REFERENCES users(id),
           updated_by UUID REFERENCES users(id),
           created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
           updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
         );`
      )
      .catch((err) => {
        _columnasAseguradas = null
        console.error("[PP] Error asegurando pp_identificacion_general / columnas:", err)
      })
  }
  return _columnasAseguradas
}
asegurarColumnas()

async function sincronizarIdentificacionGeneral(client, programaId, userId) {
  const { rows } = await client.query(
    `SELECT id, nombre, clave_programatica, modalidad_programatica, dependency_id,
            unidad_responsable, area_ejecutora, ejercicio_fiscal, fecha_elaboracion,
            responsable_integracion, cargo, correo_institucional, telefono_institucional,
            instrumento_diseno, isd, estatus
       FROM programas_presupuestarios
      WHERE id = $1`,
    [programaId]
  )
  if (!rows[0]) return
  const p = rows[0]
  const isdVal = p.isd != null ? String(p.isd).slice(0, 10) : null
  await client.query(
    `INSERT INTO pp_identificacion_general (
       id, programa_id, nombre, clave_programatica, modalidad_programatica,
       dependency_id, unidad_responsable, area_ejecutora, ejercicio_fiscal, fecha_elaboracion,
       responsable_integracion, cargo, correo_institucional, telefono_institucional,
       instrumento_diseno, isd, estatus, created_by, updated_by, updated_at
     ) VALUES (
       $1, $1, $2, $3, $4,
       $5, $6, $7, $8, $9,
       $10, $11, $12, $13,
       $14, $15, $16, $17, $17, NOW()
     )
     ON CONFLICT (programa_id) DO UPDATE SET
       nombre = EXCLUDED.nombre,
       clave_programatica = EXCLUDED.clave_programatica,
       modalidad_programatica = EXCLUDED.modalidad_programatica,
       dependency_id = EXCLUDED.dependency_id,
       unidad_responsable = EXCLUDED.unidad_responsable,
       area_ejecutora = EXCLUDED.area_ejecutora,
       ejercicio_fiscal = EXCLUDED.ejercicio_fiscal,
       fecha_elaboracion = EXCLUDED.fecha_elaboracion,
       responsable_integracion = EXCLUDED.responsable_integracion,
       cargo = EXCLUDED.cargo,
       correo_institucional = EXCLUDED.correo_institucional,
       telefono_institucional = EXCLUDED.telefono_institucional,
       instrumento_diseno = EXCLUDED.instrumento_diseno,
       isd = EXCLUDED.isd,
       estatus = EXCLUDED.estatus,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [
      p.id, p.nombre, p.clave_programatica, p.modalidad_programatica,
      p.dependency_id, p.unidad_responsable, p.area_ejecutora, p.ejercicio_fiscal, p.fecha_elaboracion,
      p.responsable_integracion, p.cargo, p.correo_institucional, p.telefono_institucional,
      p.instrumento_diseno, isdVal, p.estatus, userId || null
    ]
  )
}

const CAMPOS_VINCULACION = [
  "planning_template_id", "strategy_id",
  "eje_rector", "eje_transversal", "politica_publica", "objetivo_estrategico",
  "estrategia", "linea_accion", "ods", "instrumento_pnd", "instrumento_ped",
  "programa_derivado", "objetivo_vinculado", "contribucion"
]

function extraerVinculacion(body) {
  const b = body || {}
  const out = {}
  for (const c of CAMPOS_VINCULACION) {
    if (c in b) out[c] = vacio(b[c])
  }
  if ("instrumento_nacional_planeacion" in b && !("instrumento_pnd" in out)) {
    out.instrumento_pnd = vacio(b.instrumento_nacional_planeacion)
  }
  if ("instrumento_estatal_planeacion" in b && !("instrumento_ped" in out)) {
    out.instrumento_ped = vacio(b.instrumento_estatal_planeacion)
  }
  return out
}

async function sincronizarVinculacionEstrategica(client, programaId, vincInput, userId) {
  if (!vincInput || Object.keys(vincInput).length === 0) return

  const prevRes = await client.query(
    `SELECT planning_template_id, strategy_id, eje_rector, eje_transversal, politica_publica,
            objetivo_estrategico, estrategia, linea_accion, ods, instrumento_pnd, instrumento_ped,
            programa_derivado, objetivo_vinculado, contribucion
       FROM pp_vinculacion_estrategica
      WHERE programa_id = $1`,
    [programaId]
  )
  const prev = prevRes.rows[0] || {}
  const merged = {}
  for (const c of CAMPOS_VINCULACION) {
    merged[c] = (c in vincInput) ? vincInput[c] : (prev[c] ?? null)
  }

  await client.query(
    `INSERT INTO pp_vinculacion_estrategica (
       programa_id, planning_template_id, strategy_id,
       eje_rector, eje_transversal, politica_publica, objetivo_estrategico,
       estrategia, linea_accion, ods, instrumento_pnd, instrumento_ped,
       programa_derivado, objetivo_vinculado, contribucion,
       created_by, updated_by, updated_at
     ) VALUES (
       $1, $2, $3,
       $4, $5, $6, $7,
       $8, $9, $10, $11, $12,
       $13, $14, $15,
       $16, $16, NOW()
     )
     ON CONFLICT (programa_id) DO UPDATE SET
       planning_template_id = EXCLUDED.planning_template_id,
       strategy_id = EXCLUDED.strategy_id,
       eje_rector = EXCLUDED.eje_rector,
       eje_transversal = EXCLUDED.eje_transversal,
       politica_publica = EXCLUDED.politica_publica,
       objetivo_estrategico = EXCLUDED.objetivo_estrategico,
       estrategia = EXCLUDED.estrategia,
       linea_accion = EXCLUDED.linea_accion,
       ods = EXCLUDED.ods,
       instrumento_pnd = EXCLUDED.instrumento_pnd,
       instrumento_ped = EXCLUDED.instrumento_ped,
       programa_derivado = EXCLUDED.programa_derivado,
       objetivo_vinculado = EXCLUDED.objetivo_vinculado,
       contribucion = EXCLUDED.contribucion,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [
      programaId, merged.planning_template_id, merged.strategy_id,
      merged.eje_rector, merged.eje_transversal, merged.politica_publica, merged.objetivo_estrategico,
      merged.estrategia, merged.linea_accion, merged.ods, merged.instrumento_pnd, merged.instrumento_ped,
      merged.programa_derivado, merged.objetivo_vinculado, merged.contribucion,
      userId || null
    ]
  )
}

const CAMPOS_PROBLEMA_PUBLICO = [
  "problema_publico_d", "poblacion_afectada", "ubicacion_territorial",
  "magnitud", "unidad_medida", "fuentes_informacion", "periodo",
  "antecedentes", "causas_preliminares", "efectos_preliminares", "justificacion"
]

function extraerProblemaPublico(body) {
  const b = body || {}
  const out = {}
  for (const c of CAMPOS_PROBLEMA_PUBLICO) {
    if (c in b) {
      out[c] = c === "magnitud" ? num(b[c]) : vacio(b[c])
    }
  }
  if ("problematica_publica" in b && !("problema_publico_d" in out)) out.problema_publico_d = vacio(b.problematica_publica)
  if ("poblacion_area_afectada" in b && !("poblacion_afectada" in out)) out.poblacion_afectada = vacio(b.poblacion_area_afectada)
  if ("magnitud_unidad_medida" in b && !("unidad_medida" in out)) out.unidad_medida = vacio(b.magnitud_unidad_medida)
  if ("fuente_informacion" in b && !("fuentes_informacion" in out)) out.fuentes_informacion = vacio(b.fuente_informacion)
  if ("anio_periodo_diagnostico" in b && !("periodo" in out)) {
    const p = vacio(b.anio_periodo_diagnostico)
    out.periodo = p == null ? null : String(p)
  }
  if ("justificacion_intervencion" in b && !("justificacion" in out)) out.justificacion = vacio(b.justificacion_intervencion)
  return out
}

async function sincronizarProblemaPublico(client, programaId, probInput, userId) {
  if (!probInput || Object.keys(probInput).length === 0) return

  const prevRes = await client.query(
    `SELECT problema_publico_d, poblacion_afectada, ubicacion_territorial,
            magnitud, unidad_medida, fuentes_informacion, periodo,
            antecedentes, causas_preliminares, efectos_preliminares, justificacion
       FROM pp_problema_publico
      WHERE programa_id = $1`,
    [programaId]
  )
  const prev = prevRes.rows[0] || {}
  const merged = {}
  for (const c of CAMPOS_PROBLEMA_PUBLICO) {
    merged[c] = (c in probInput) ? probInput[c] : (prev[c] ?? null)
  }
  if (Number.isNaN(merged.magnitud)) merged.magnitud = null

  await client.query(
    `INSERT INTO pp_problema_publico (
       programa_id, problema_publico_d, poblacion_afectada, ubicacion_territorial,
       magnitud, unidad_medida, fuentes_informacion, periodo,
       antecedentes, causas_preliminares, efectos_preliminares, justificacion,
       created_by, updated_by, updated_at
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7, $8,
       $9, $10, $11, $12,
       $13, $13, NOW()
     )
     ON CONFLICT (programa_id) DO UPDATE SET
       problema_publico_d = EXCLUDED.problema_publico_d,
       poblacion_afectada = EXCLUDED.poblacion_afectada,
       ubicacion_territorial = EXCLUDED.ubicacion_territorial,
       magnitud = EXCLUDED.magnitud,
       unidad_medida = EXCLUDED.unidad_medida,
       fuentes_informacion = EXCLUDED.fuentes_informacion,
       periodo = EXCLUDED.periodo,
       antecedentes = EXCLUDED.antecedentes,
       causas_preliminares = EXCLUDED.causas_preliminares,
       efectos_preliminares = EXCLUDED.efectos_preliminares,
       justificacion = EXCLUDED.justificacion,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [
      programaId, merged.problema_publico_d, merged.poblacion_afectada, merged.ubicacion_territorial,
      merged.magnitud, merged.unidad_medida, merged.fuentes_informacion, merged.periodo,
      merged.antecedentes, merged.causas_preliminares, merged.efectos_preliminares, merged.justificacion,
      userId || null
    ]
  )
}

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
  if ("instrumento_diseño" in b && !("instrumento_diseno" in o)) {
    o.instrumento_diseno = vacio(b["instrumento_diseño"])
  }
  if ("ISD" in b && !("isd" in o)) {
    o.isd = vacio(b.ISD)
  }
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
  if (campos.isd && String(campos.isd).length > 10) e.push("El campo ISD no puede exceder los 10 caracteres.")

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
    `SELECT pp.*,
            COALESCE(ig.nombre, pp.nombre) AS nombre,
            COALESCE(ig.clave_programatica, pp.clave_programatica) AS clave_programatica,
            COALESCE(ig.modalidad_programatica, pp.modalidad_programatica) AS modalidad_programatica,
            COALESCE(ig.unidad_responsable, pp.unidad_responsable) AS unidad_responsable,
            COALESCE(ig.area_ejecutora, pp.area_ejecutora) AS area_ejecutora,
            COALESCE(ig.fecha_elaboracion, pp.fecha_elaboracion) AS fecha_elaboracion,
            COALESCE(ig.responsable_integracion, pp.responsable_integracion) AS responsable_integracion,
            COALESCE(ig.cargo, pp.cargo) AS cargo,
            COALESCE(ig.correo_institucional, pp.correo_institucional) AS correo_institucional,
            COALESCE(ig.telefono_institucional, pp.telefono_institucional) AS telefono_institucional,
            COALESCE(ig.instrumento_diseno, pp.instrumento_diseno) AS instrumento_diseno,
            COALESCE(ig.isd, pp.isd) AS isd,
            COALESCE(ve.eje_rector, pp.eje_rector) AS eje_rector,
            COALESCE(ve.eje_transversal, pp.eje_transversal) AS eje_transversal,
            COALESCE(ve.politica_publica, pp.politica_publica) AS politica_publica,
            COALESCE(ve.objetivo_estrategico, pp.objetivo_estrategico) AS objetivo_estrategico,
            COALESCE(ve.estrategia, pp.estrategia) AS estrategia,
            COALESCE(ve.linea_accion, pp.linea_accion) AS linea_accion,
            COALESCE(ve.ods, pp.ods) AS ods,
            COALESCE(ve.instrumento_pnd, pp.instrumento_nacional_planeacion) AS instrumento_pnd,
            COALESCE(ve.instrumento_ped, pp.instrumento_estatal_planeacion) AS instrumento_ped,
            ve.programa_derivado AS programa_derivado,
            ve.objetivo_vinculado AS objetivo_vinculado,
            ve.contribucion AS contribucion,
            COALESCE(pr.problema_publico_d, pp.problematica_publica) AS problema_publico_d,
            COALESCE(pr.poblacion_afectada, pp.poblacion_area_afectada) AS poblacion_afectada,
            COALESCE(pr.ubicacion_territorial, pp.ubicacion_territorial) AS ubicacion_territorial,
            COALESCE(pr.magnitud, pp.magnitud) AS magnitud,
            COALESCE(pr.unidad_medida, pp.magnitud_unidad_medida) AS unidad_medida,
            COALESCE(pr.fuentes_informacion, pp.fuente_informacion) AS fuentes_informacion,
            COALESCE(pr.periodo, pp.anio_periodo_diagnostico::text) AS periodo,
            COALESCE(pr.antecedentes, pp.antecedentes) AS antecedentes,
            COALESCE(pr.causas_preliminares, pp.causas_preliminares) AS causas_preliminares,
            COALESCE(pr.efectos_preliminares, pp.efectos_preliminares) AS efectos_preliminares,
            COALESCE(pr.justificacion, pp.justificacion_intervencion) AS justificacion,
            d.name AS dependencia
       FROM programas_presupuestarios pp
       LEFT JOIN pp_identificacion_general ig ON ig.programa_id = pp.id
       LEFT JOIN pp_vinculacion_estrategica ve ON ve.programa_id = pp.id
       LEFT JOIN pp_problema_publico pr ON pr.programa_id = pp.id
       JOIN dependencies d ON d.id = pp.dependency_id
      WHERE pp.id = $1`, [id])
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
    instrumento_diseno: rows[0].instrumento_diseno ?? null,
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
  await asegurarColumnas()
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
    await sincronizarIdentificacionGeneral(client, req.params.id, u.id)
    await sincronizarVinculacionEstrategica(client, req.params.id, extraerVinculacion(body), u.id)
    await sincronizarProblemaPublico(client, req.params.id, extraerProblemaPublico(body), u.id)
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
      await client.query("UPDATE pp_identificacion_general SET estatus=$1, updated_by=$2, updated_at=NOW() WHERE programa_id=$3",
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



// =====================================================================
// CRUD de programas presupuestarios (lo usa el frontend actual:
// ProgramasPresupuestarios.jsx -> /prefill, listado, /:id, POST, PUT, DELETE).
// Se conserva junto con los endpoints de ficha/validación de arriba.
// Los helpers llevan sufijo "Crud" para no chocar con los de la ficha.
// =====================================================================

const CAMPOS_TEXTO_CRUD = [
  "nombre", "clave_programatica", "modalidad_programatica", "instrumento_diseno", "isd", "unidad_responsable", "area_ejecutora",
  "responsable_integracion", "cargo", "correo_institucional", "telefono_institucional",
  "problematica_publica", "diagnostico_general", "justificacion_intervencion",
  "poblacion_area_afectada", "ubicacion_territorial", "magnitud_unidad_medida",
  "antecedentes", "causas_preliminares", "efectos_preliminares",
  "eje_rector", "eje_transversal", "politica_publica", "objetivo_estrategico", "estrategia", "linea_accion", "ods",
  "objetivo_institucional", "resultado_esperado", "contribucion_programa",
  "objetivo_general",
  "poblacion_potencial", "poblacion_objetivo", "poblacion_atendida_estimada", "metodo_cuantificacion", "fuente_informacion",
  "municipio", "localidades_beneficiadas", "colonias_beneficiadas", "cobertura_urbana", "cobertura_rural",
  "supuesto_estrategico", "supuesto_operativo", "supuesto_financiero", "supuesto_externo",
]
const CAMPOS_BOOL_CRUD = ["usa_mir", "usa_fime", "usa_fiseg"]
const CAMPOS_OTROS_CRUD = ["dependency_id", "strategy_id", "planning_template_id", "ejercicio_fiscal", "fecha_elaboracion", "estatus"]

const DIMENSIONES = ["Eficacia", "Eficiencia", "Calidad", "Economía"]
const ESTATUS = ["borrador", "en_revision", "validado", "rechazado"]

const puedeEscribir = (u) => ROLES_TODAS_DEPENDENCIAS.includes(u.rol) || ROLES_DEPENDENCIA.includes(u.rol)

function extraerCamposCrud(body) {
  const out = {}
  for (const c of CAMPOS_TEXTO_CRUD) if (c in body) out[c] = vacio(body[c])
  if ("instrumento_diseño" in body && !("instrumento_diseno" in out)) {
    out.instrumento_diseno = vacio(body["instrumento_diseño"])
  }
  if ("ISD" in body && !("isd" in out)) {
    out.isd = vacio(body.ISD)
  }
  if ("instrumento_pnd" in body && !("instrumento_nacional_planeacion" in out)) {
    out.instrumento_nacional_planeacion = vacio(body.instrumento_pnd)
  }
  if ("instrumento_ped" in body && !("instrumento_estatal_planeacion" in out)) {
    out.instrumento_estatal_planeacion = vacio(body.instrumento_ped)
  }
  if ("problema_publico_d" in body && !("problematica_publica" in out)) out.problematica_publica = vacio(body.problema_publico_d)
  if ("poblacion_afectada" in body && !("poblacion_area_afectada" in out)) out.poblacion_area_afectada = vacio(body.poblacion_afectada)
  if ("unidad_medida" in body && !("magnitud_unidad_medida" in out)) out.magnitud_unidad_medida = vacio(body.unidad_medida)
  if ("fuentes_informacion" in body && !("fuente_informacion" in out)) out.fuente_informacion = vacio(body.fuentes_informacion)
  if ("justificacion" in body && !("justificacion_intervencion" in out)) out.justificacion_intervencion = vacio(body.justificacion)
  if ("magnitud" in body) out.magnitud = num(body.magnitud)
  if ("periodo" in body) {
    const pStr = vacio(body.periodo)
    if (pStr && /^\d{4}$/.test(String(pStr))) {
      out.anio_periodo_diagnostico = Number(pStr)
    } else if (pStr === null) {
      out.anio_periodo_diagnostico = null
    }
  }
  for (const c of CAMPOS_BOOL_CRUD) if (c in body) out[c] = body[c] === true || body[c] === "true" || body[c] === 1
  for (const c of CAMPOS_OTROS_CRUD) if (c in body) out[c] = vacio(body[c])
  return out
}

function validarCrud(campos, hijos, esCreacion) {
  const errores = []
  if (esCreacion) {
    if (!campos.nombre) errores.push("El nombre del programa presupuestario es obligatorio.")
    if (!campos.dependency_id) errores.push("La dependencia responsable es obligatoria.")
    if (!campos.ejercicio_fiscal) errores.push("El ejercicio fiscal es obligatorio.")
  } else {
    if ("nombre" in campos && !campos.nombre) errores.push("El nombre no puede quedar vacío.")
    if ("ejercicio_fiscal" in campos && !campos.ejercicio_fiscal) errores.push("El ejercicio fiscal no puede quedar vacío.")
  }
  if (campos.ejercicio_fiscal != null) {
    const a = Number(campos.ejercicio_fiscal)
    if (!Number.isInteger(a) || a < 2024 || a > 2100) errores.push("Ejercicio fiscal inválido.")
  }
  if (campos.estatus && !ESTATUS.includes(campos.estatus)) errores.push("Estatus inválido.")
  if (campos.correo_institucional && !/^\S+@\S+\.\S+$/.test(campos.correo_institucional)) {
    errores.push("El correo institucional no tiene formato válido.")
  }
  if (campos.isd && String(campos.isd).length > 10) {
    errores.push("El campo ISD no puede exceder los 10 caracteres.")
  }
  if (campos.magnitud !== undefined && campos.magnitud !== null) {
    if (Number.isNaN(campos.magnitud) || campos.magnitud < 0) {
      errores.push("La magnitud debe ser un número mayor o igual a cero.")
    }
  }

  if (hijos.objetivos_especificos && hijos.objetivos_especificos.length > 5) {
    errores.push("Máximo 5 objetivos específicos.")
  }
  if (hijos.bienes_servicios && hijos.bienes_servicios.length > 5) {
    errores.push("Máximo 5 bienes o servicios.")
  }
  for (const i of hijos.indicadores || []) {
    if (i.dimension && !DIMENSIONES.includes(i.dimension)) {
      errores.push(`Dimensión inválida en indicador "${i.nombre_indicador || ""}". Usa: ${DIMENSIONES.join(", ")}.`)
    }
  }
  return errores
}

function extraerHijosCrud(body) {
  const h = {}
  const arr = (x) => (Array.isArray(x) ? x : null)

  const der = arr(body.programas_derivados)
  if (der) {
    h.programas_derivados = der
      .map((r) => ({ programa: vacio(r.programa), objetivo_vinculado: vacio(r.objetivo_vinculado) }))
      .filter((r) => r.programa)
  }
  const obj = arr(body.objetivos_especificos)
  if (obj) {
    h.objetivos_especificos = obj
      .map((r) => (typeof r === "string" ? vacio(r) : vacio(r?.objetivo)))
      .filter(Boolean)
  }
  const bys = arr(body.bienes_servicios)
  if (bys) {
    h.bienes_servicios = bys
      .map((r) => ({ bien_servicio: vacio(r.bien_servicio), unidad_medida: vacio(r.unidad_medida) }))
      .filter((r) => r.bien_servicio)
  }
  const ind = arr(body.indicadores)
  if (ind) {
    h.indicadores = ind
      .map((r) => ({
        nombre_indicador: vacio(r.nombre_indicador),
        dimension: vacio(r.dimension),
        frecuencia: vacio(r.frecuencia),
        meta_anual: vacio(r.meta_anual === undefined || r.meta_anual === null ? r.meta_anual : String(r.meta_anual)),
        medio_verificacion: vacio(r.medio_verificacion),
      }))
      .filter((r) => r.nombre_indicador)
  }
  return h
}

async function guardarHijosCrud(client, programaId, h) {
  if (h.programas_derivados) {
    await client.query("DELETE FROM pp_programas_derivados WHERE programa_id = $1", [programaId])
    for (let i = 0; i < h.programas_derivados.length; i++) {
      const r = h.programas_derivados[i]
      await client.query(
        `INSERT INTO pp_programas_derivados (programa_id, orden, programa, objetivo_vinculado)
         VALUES ($1,$2,$3,$4)`,
        [programaId, i + 1, r.programa, r.objetivo_vinculado]
      )
    }
  }
  if (h.objetivos_especificos) {
    await client.query("DELETE FROM pp_objetivos_especificos WHERE programa_id = $1", [programaId])
    for (let i = 0; i < h.objetivos_especificos.length; i++) {
      await client.query(
        `INSERT INTO pp_objetivos_especificos (programa_id, numero, objetivo) VALUES ($1,$2,$3)`,
        [programaId, i + 1, h.objetivos_especificos[i]]
      )
    }
  }
  if (h.bienes_servicios) {
    await client.query("DELETE FROM pp_bienes_servicios WHERE programa_id = $1", [programaId])
    for (let i = 0; i < h.bienes_servicios.length; i++) {
      const r = h.bienes_servicios[i]
      await client.query(
        `INSERT INTO pp_bienes_servicios (programa_id, numero, bien_servicio, unidad_medida)
         VALUES ($1,$2,$3,$4)`,
        [programaId, i + 1, r.bien_servicio, r.unidad_medida]
      )
    }
  }
  if (h.indicadores) {
    await client.query("DELETE FROM pp_indicadores_preliminares WHERE programa_id = $1", [programaId])
    for (let i = 0; i < h.indicadores.length; i++) {
      const r = h.indicadores[i]
      await client.query(
        `INSERT INTO pp_indicadores_preliminares
           (programa_id, orden, nombre_indicador, dimension, frecuencia, meta_anual, medio_verificacion)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [programaId, i + 1, r.nombre_indicador, r.dimension, r.frecuencia, r.meta_anual, r.medio_verificacion]
      )
    }
  }
}

async function cargarCompleto(programaId) {
  const { rows } = await pool.query(
    `SELECT pp.*,
            COALESCE(ig.nombre, pp.nombre) AS nombre,
            COALESCE(ig.clave_programatica, pp.clave_programatica) AS clave_programatica,
            COALESCE(ig.modalidad_programatica, pp.modalidad_programatica) AS modalidad_programatica,
            COALESCE(ig.unidad_responsable, pp.unidad_responsable) AS unidad_responsable,
            COALESCE(ig.area_ejecutora, pp.area_ejecutora) AS area_ejecutora,
            COALESCE(ig.fecha_elaboracion, pp.fecha_elaboracion) AS fecha_elaboracion,
            COALESCE(ig.responsable_integracion, pp.responsable_integracion) AS responsable_integracion,
            COALESCE(ig.cargo, pp.cargo) AS cargo,
            COALESCE(ig.correo_institucional, pp.correo_institucional) AS correo_institucional,
            COALESCE(ig.telefono_institucional, pp.telefono_institucional) AS telefono_institucional,
            COALESCE(ig.instrumento_diseno, pp.instrumento_diseno) AS instrumento_diseno,
            COALESCE(ig.isd, pp.isd) AS isd,
            COALESCE(ve.planning_template_id, pp.planning_template_id) AS planning_template_id,
            COALESCE(ve.strategy_id, pp.strategy_id) AS strategy_id,
            COALESCE(ve.eje_rector, pp.eje_rector) AS eje_rector,
            COALESCE(ve.eje_transversal, pp.eje_transversal) AS eje_transversal,
            COALESCE(ve.politica_publica, pp.politica_publica) AS politica_publica,
            COALESCE(ve.objetivo_estrategico, pp.objetivo_estrategico) AS objetivo_estrategico,
            COALESCE(ve.estrategia, pp.estrategia) AS estrategia,
            COALESCE(ve.linea_accion, pp.linea_accion) AS linea_accion,
            COALESCE(ve.ods, pp.ods) AS ods,
            COALESCE(ve.instrumento_pnd, pp.instrumento_nacional_planeacion) AS instrumento_pnd,
            COALESCE(ve.instrumento_ped, pp.instrumento_estatal_planeacion) AS instrumento_ped,
            ve.programa_derivado AS programa_derivado,
            ve.objetivo_vinculado AS objetivo_vinculado,
            ve.contribucion AS contribucion,
            COALESCE(pr.problema_publico_d, pp.problematica_publica) AS problema_publico_d,
            COALESCE(pr.poblacion_afectada, pp.poblacion_area_afectada) AS poblacion_afectada,
            COALESCE(pr.ubicacion_territorial, pp.ubicacion_territorial) AS ubicacion_territorial,
            COALESCE(pr.magnitud, pp.magnitud) AS magnitud,
            COALESCE(pr.unidad_medida, pp.magnitud_unidad_medida) AS unidad_medida,
            COALESCE(pr.fuentes_informacion, pp.fuente_informacion) AS fuentes_informacion,
            COALESCE(pr.periodo, pp.anio_periodo_diagnostico::text) AS periodo,
            COALESCE(pr.antecedentes, pp.antecedentes) AS antecedentes,
            COALESCE(pr.causas_preliminares, pp.causas_preliminares) AS causas_preliminares,
            COALESCE(pr.efectos_preliminares, pp.efectos_preliminares) AS efectos_preliminares,
            COALESCE(pr.justificacion, pp.justificacion_intervencion) AS justificacion,
            d.name AS dependencia
       FROM programas_presupuestarios pp
       LEFT JOIN pp_identificacion_general ig ON ig.programa_id = pp.id
       LEFT JOIN pp_vinculacion_estrategica ve ON ve.programa_id = pp.id
       LEFT JOIN pp_problema_publico pr ON pr.programa_id = pp.id
       JOIN dependencies d ON d.id = pp.dependency_id
      WHERE pp.id = $1`,
    [programaId]
  )
  if (!rows[0]) return null
  const [der, obj, bys, ind] = await Promise.all([
    pool.query("SELECT programa, objetivo_vinculado FROM pp_programas_derivados WHERE programa_id=$1 ORDER BY orden", [programaId]),
    pool.query("SELECT numero, objetivo FROM pp_objetivos_especificos WHERE programa_id=$1 ORDER BY numero", [programaId]),
    pool.query("SELECT numero, bien_servicio, unidad_medida FROM pp_bienes_servicios WHERE programa_id=$1 ORDER BY numero", [programaId]),
    pool.query(
      `SELECT nombre_indicador, dimension, frecuencia, meta_anual, medio_verificacion
         FROM pp_indicadores_preliminares WHERE programa_id=$1 ORDER BY orden`,
      [programaId]
    ),
  ])
  return {
    ...rows[0],
    programas_derivados: der.rows,
    objetivos_especificos: obj.rows,
    bienes_servicios: bys.rows,
    indicadores: ind.rows,
  }
}

function errorBD(res, e, accion) {
  console.error(`[PP] Error al ${accion}:`, e)
  if (e.code === "23505") {
    return res.status(409).json({ error: "Ya existe un programa con ese nombre o esa clave programática en la misma dependencia y ejercicio." })
  }
  if (e.code === "23503") {
    return res.status(400).json({ error: "La dependencia o la estrategia indicada no existe." })
  }
  return res.status(500).json({ error: `No se pudo ${accion} el programa presupuestario.` })
}


exports.prefill = async (req, res) => {
  try {
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })

    let dependencia = null
    if (u.dependency_id) {
      const r = await pool.query("SELECT id, name FROM dependencies WHERE id = $1", [u.dependency_id])
      dependencia = r.rows[0] || null
    }
    const hoy = new Date()
    res.json({
      dependency_id: dependencia?.id || null,
      dependencia: dependencia?.name || null,
      ejercicio_fiscal: hoy.getFullYear(),
      fecha_elaboracion: hoy.toISOString().slice(0, 10),
      responsable_integracion: u.name || null,
      cargo: u.dependency_position || null,
      correo_institucional: u.email || null,
    })
  } catch (e) {
    console.error("[PP] prefill:", e)
    res.status(500).json({ error: "No se pudo obtener la información previa." })
  }
}


exports.catalogos = async (req, res) => {
  try {
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })

    const [programasRes, depsRes] = await Promise.all([
      pool.query(`SELECT id, clave, descripcion FROM cat_programas ORDER BY clave`),
      pool.query(`
        SELECT d.id, d.name, d.abreviatura
          FROM dependencies d
         WHERE d.id NOT IN (
           SELECT dependency_id
             FROM dep_agrupaciones
            WHERE dependency_id != grupo_id
         )
         ORDER BY d.name
      `),
    ])

    res.json({
      programas: programasRes.rows,
      dependencias: depsRes.rows,
    })
  } catch (e) {
    console.error("[PP] catalogos:", e)
    res.status(500).json({ error: "No se pudieron obtener los catálogos." })
  }
}

exports.unidadesResponsables = async (req, res) => {
  try {
    await asegurarColumnas()
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })

    const depId = req.params.dependency_id
    if (!depId) return res.status(400).json({ error: "Indica dependency_id." })
    if (!veTodo(u) && !esMisma(u, depId)) {
      return res.status(403).json({ error: "Solo puedes consultar unidades responsables de tu dependencia." })
    }

    const { rows } = await pool.query(
      `WITH deps_relacionadas AS (
         SELECT $1::uuid AS id
         UNION
         SELECT dependency_id FROM dep_agrupaciones WHERE grupo_id = $1::uuid
         UNION
         SELECT grupo_id FROM dep_agrupaciones WHERE dependency_id = $1::uuid
       ),
       todas AS (
         SELECT BTRIM(unidad_responsable) AS ur
           FROM cip_proyectos
          WHERE dependency_id IN (SELECT id FROM deps_relacionadas)
            AND unidad_responsable IS NOT NULL
            AND BTRIM(unidad_responsable) <> ''
         UNION
         SELECT BTRIM(unidad_responsable) AS ur
           FROM pp_identificacion_general
          WHERE dependency_id IN (SELECT id FROM deps_relacionadas)
            AND unidad_responsable IS NOT NULL
            AND BTRIM(unidad_responsable) <> ''
       )
       SELECT DISTINCT ON (LOWER(ur)) ur
         FROM todas
        ORDER BY LOWER(ur), LENGTH(ur) DESC`,
      [depId]
    )

    let unidades = rows.map((r) => r.ur).sort((a, b) => a.localeCompare(b, "es"))

    if (unidades.length === 0) {
      const depRow = await pool.query("SELECT name FROM dependencies WHERE id = $1", [depId])
      if (depRow.rows[0]?.name) unidades = [depRow.rows[0].name]
    }

    res.json({ unidades_responsables: unidades })
  } catch (e) {
    if (e.code === "22P02") return res.status(400).json({ error: "Identificador de dependencia inválido." })
    console.error("[PP] unidadesResponsables:", e)
    res.status(500).json({ error: "No se pudieron obtener las unidades responsables." })
  }
}

exports.catalogosVinculacion = async (req, res) => {
  try {
    await asegurarColumnas()
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })

    const depId = req.params.dependency_id
    if (!depId) return res.status(400).json({ error: "Indica dependency_id." })
    if (!veTodo(u) && !esMisma(u, depId)) {
      return res.status(403).json({ error: "Solo puedes consultar vinculación de tu dependencia." })
    }

    const [pmdRows, ejesPmdRes, transvRes, odsRes, pndRes, pedRes] = await Promise.all([
      pool.query(
        `WITH deps_relacionadas AS (
           SELECT $1::uuid AS id
           UNION
           SELECT dependency_id FROM dep_agrupaciones WHERE grupo_id = $1::uuid
           UNION
           SELECT grupo_id FROM dep_agrupaciones WHERE dependency_id = $1::uuid
         )
         SELECT
           pt.id AS planning_template_id,
           pt.strategy_id,
           BTRIM(COALESCE(pt.pmd_eje, '')) AS eje_rector,
           BTRIM(COALESCE(pt.pmd_politica_publica, '')) AS politica_publica,
           BTRIM(COALESCE(pt.pmd_objetivo, '')) AS objetivo_estrategico,
           BTRIM(COALESCE(pt.pmd_estrategia, s.name, '')) AS estrategia,
           BTRIM(COALESCE(pt.lineas_accion, '')) AS linea_accion,
           BTRIM(COALESCE(pt.nomenclatura, '')) AS nomenclatura
         FROM planning_templates pt
         LEFT JOIN strategies s ON s.id = pt.strategy_id
         WHERE pt.dependency_id IN (SELECT id FROM deps_relacionadas)
           AND (pt.pmd_eje IS NOT NULL OR pt.pmd_estrategia IS NOT NULL OR pt.lineas_accion IS NOT NULL)
         UNION ALL
         SELECT
           NULL::uuid AS planning_template_id,
           NULL::uuid AS strategy_id,
           BTRIM(COALESCE(na.eje_pmd, '')) AS eje_rector,
           BTRIM(COALESCE(na.politica_publica, '')) AS politica_publica,
           BTRIM(COALESCE(na.objetivo, '')) AS objetivo_estrategico,
           BTRIM(COALESCE(na.estrategia, '')) AS estrategia,
           BTRIM(COALESCE(CASE WHEN la.id IS NOT NULL THEN CONCAT(la.nomenclatura, ' ', la.descripcion) ELSE '' END, '')) AS linea_accion,
           BTRIM(COALESCE(la.nomenclatura, '')) AS nomenclatura
         FROM nueva_alineacion na
         LEFT JOIN lineas_accion la ON la.alineacion_id = na.id
         WHERE na.dependencia_id IN (SELECT id FROM deps_relacionadas)
         ORDER BY eje_rector, politica_publica, estrategia, nomenclatura`,
        [depId]
      ),
      pool.query(`SELECT id, tipo_eje, nombre FROM pmd_ejes ORDER BY id`),
      pool.query(
        `SELECT 'PND' AS origen, id, tipo_eje, nombre
           FROM pnd_ejes
          WHERE tipo_eje ILIKE '%transversal%'
         UNION ALL
         SELECT 'PED' AS origen, id, tipo_eje, nombre
           FROM ped_ejes
          WHERE tipo_eje ILIKE '%transversal%'
         ORDER BY origen, id`
      ),
      pool.query(`SELECT id, numero, codigo, nombre FROM ods_objetivos ORDER BY numero`),
      pool.query(`SELECT id, tipo_eje, nombre FROM pnd_ejes ORDER BY id`),
      pool.query(`SELECT id, tipo_eje, nombre FROM ped_ejes ORDER BY id`),
    ])

    res.json({
      alineacion_pmd: pmdRows.rows,
      ejes_rectores: ejesPmdRes.rows,
      ejes_transversales: transvRes.rows,
      ods: odsRes.rows,
      pnd: pndRes.rows,
      ped: pedRes.rows,
    })
  } catch (e) {
    if (e.code === "22P02") return res.status(400).json({ error: "Identificador de dependencia inválido." })
    console.error("[PP] catalogosVinculacion:", e)
    res.status(500).json({ error: "No se pudieron obtener los catálogos de vinculación estratégica." })
  }
}

exports.listar = async (req, res) => {
  try {
    await asegurarColumnas()
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })

    const where = []
    const params = []
    const add = (sql, v) => { params.push(v); where.push(sql.replace("?", `$${params.length}`)) }

    if (!veTodo(u)) {
      if (!u.dependency_id) return res.json({ data: [], total: 0, page: 1, limit: 20 })
      add("pp.dependency_id = ?", u.dependency_id)
    } else if (req.query.dependency_id) {
      add("pp.dependency_id = ?", req.query.dependency_id)
    }
    if (req.query.anio) add("pp.ejercicio_fiscal = ?", Number(req.query.anio))
    if (req.query.estatus) add("pp.estatus = ?", req.query.estatus)
    if (req.query.q) {
      params.push(`%${String(req.query.q).trim()}%`)
      const p = `$${params.length}`
      where.push(`(pp.nombre ILIKE ${p} OR pp.clave_programatica ILIKE ${p} OR d.name ILIKE ${p})`)
    }

    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const offset = (page - 1) * limit
    const w = where.length ? `WHERE ${where.join(" AND ")}` : ""

    const [datos, total] = await Promise.all([
      pool.query(
        `SELECT pp.id,
                COALESCE(ig.nombre, pp.nombre) AS nombre,
                COALESCE(ig.clave_programatica, pp.clave_programatica) AS clave_programatica,
                COALESCE(ig.modalidad_programatica, pp.modalidad_programatica) AS modalidad_programatica,
                COALESCE(ig.instrumento_diseno, pp.instrumento_diseno) AS instrumento_diseno,
                COALESCE(ig.isd, pp.isd) AS isd,
                COALESCE(ig.ejercicio_fiscal, pp.ejercicio_fiscal) AS ejercicio_fiscal,
                COALESCE(ig.estatus, pp.estatus) AS estatus,
                pp.dependency_id,
                d.name AS dependencia,
                COALESCE(ig.unidad_responsable, pp.unidad_responsable) AS unidad_responsable,
                COALESCE(ig.fecha_elaboracion, pp.fecha_elaboracion) AS fecha_elaboracion,
                COALESCE(ig.updated_at, pp.updated_at) AS updated_at
           FROM programas_presupuestarios pp
           LEFT JOIN pp_identificacion_general ig ON ig.programa_id = pp.id
           JOIN dependencies d ON d.id = pp.dependency_id
           ${w}
          ORDER BY pp.ejercicio_fiscal DESC, d.name, pp.nombre
          LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
      pool.query(
        `SELECT COUNT(*)::int AS n
           FROM programas_presupuestarios pp
           JOIN dependencies d ON d.id = pp.dependency_id
           ${w}`,
        params
      ),
    ])
    res.json({ data: datos.rows, total: total.rows[0].n, page, limit })
  } catch (e) {
    console.error("[PP] listar:", e)
    res.status(500).json({ error: "No se pudo obtener el listado de programas presupuestarios." })
  }
}


exports.obtener = async (req, res) => {
  try {
    await asegurarColumnas()
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })

    const prog = await cargarCompleto(req.params.id)
    if (!prog) return res.status(404).json({ error: "Programa presupuestario no encontrado." })
    if (!veTodo(u) && !esMisma(u, prog.dependency_id)) {
      return res.status(403).json({ error: "No tienes acceso a este programa." })
    }
    res.json(prog)
  } catch (e) {
    if (e.code === "22P02") return res.status(400).json({ error: "Identificador inválido." })
    console.error("[PP] obtener:", e)
    res.status(500).json({ error: "No se pudo obtener el programa presupuestario." })
  }
}


exports.crear = async (req, res) => {
  await asegurarColumnas()
  const client = await pool.connect()
  try {
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })
    if (!puedeEscribir(u)) return res.status(403).json({ error: "Tu rol no puede crear programas presupuestarios." })

    const campos = extraerCamposCrud(req.body || {})
    const hijos = extraerHijosCrud(req.body || {})

    if (ROLES_DEPENDENCIA.includes(u.rol)) {
      if (!u.dependency_id) return res.status(403).json({ error: "Tu usuario no tiene dependencia asignada." })
      campos.dependency_id = u.dependency_id
    }
    if (!ROLES_TODAS_DEPENDENCIAS.includes(u.rol)) campos.estatus = "borrador"

    if (campos.nombre && !campos.clave_programatica) {
      const cat = await pool.query(
        "SELECT clave FROM cat_programas WHERE LOWER(BTRIM(descripcion)) = LOWER(BTRIM($1)) LIMIT 1",
        [campos.nombre]
      )
      if (cat.rows[0]?.clave) campos.clave_programatica = cat.rows[0].clave
    }

    const errores = validarCrud(campos, hijos, true)
    if (errores.length) return res.status(400).json({ error: errores[0], errores })

    const cols = Object.keys(campos)
    const vals = cols.map((c) => campos[c])
    cols.push("created_by", "updated_by")
    vals.push(u.id, u.id)

    await client.query("BEGIN")
    const ins = await client.query(
      `INSERT INTO programas_presupuestarios (${cols.join(",")})
       VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")})
       RETURNING id`,
      vals
    )
    const id = ins.rows[0].id
    await sincronizarIdentificacionGeneral(client, id, u.id)
    await sincronizarVinculacionEstrategica(client, id, extraerVinculacion(req.body), u.id)
    await sincronizarProblemaPublico(client, id, extraerProblemaPublico(req.body), u.id)
    await guardarHijosCrud(client, id, hijos)
    await client.query("COMMIT")

    res.status(201).json(await cargarCompleto(id))
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {})
    errorBD(res, e, "crear")
  } finally {
    client.release()
  }
}


exports.actualizar = async (req, res) => {
  await asegurarColumnas()
  const client = await pool.connect()
  try {
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })
    if (!puedeEscribir(u)) return res.status(403).json({ error: "Tu rol no puede editar programas presupuestarios." })

    const actual = await pool.query(
      "SELECT dependency_id, estatus FROM programas_presupuestarios WHERE id = $1",
      [req.params.id]
    )
    if (!actual.rows[0]) return res.status(404).json({ error: "Programa presupuestario no encontrado." })

    const esDependencia = ROLES_DEPENDENCIA.includes(u.rol)
    if (esDependencia && !esMisma(u, actual.rows[0].dependency_id)) {
      return res.status(403).json({ error: "Solo puedes editar programas de tu dependencia." })
    }
    if (esDependencia && actual.rows[0].estatus === "validado") {
      return res.status(409).json({ error: "El programa ya está validado; solo Planeación puede modificarlo." })
    }

    const campos = extraerCamposCrud(req.body || {})
    const hijos = extraerHijosCrud(req.body || {})

    if (esDependencia) {
      delete campos.dependency_id
      if (campos.estatus && !["borrador", "en_revision"].includes(campos.estatus)) delete campos.estatus
    }

    const errores = validarCrud(campos, hijos, false)
    if (errores.length) return res.status(400).json({ error: errores[0], errores })

    const cols = Object.keys(campos)
    const sets = cols.map((c, i) => `${c} = $${i + 1}`)
    const vals = cols.map((c) => campos[c])
    sets.push(`updated_by = $${vals.length + 1}`, "updated_at = NOW()")
    vals.push(u.id)
    vals.push(req.params.id)

    await client.query("BEGIN")
    await client.query(
      `UPDATE programas_presupuestarios SET ${sets.join(", ")} WHERE id = $${vals.length}`,
      vals
    )
    await sincronizarIdentificacionGeneral(client, req.params.id, u.id)
    await sincronizarVinculacionEstrategica(client, req.params.id, extraerVinculacion(req.body), u.id)
    await sincronizarProblemaPublico(client, req.params.id, extraerProblemaPublico(req.body), u.id)
    await guardarHijosCrud(client, req.params.id, hijos)
    await client.query("COMMIT")

    res.json(await cargarCompleto(req.params.id))
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {})
    if (e.code === "22P02") return res.status(400).json({ error: "Identificador inválido." })
    errorBD(res, e, "actualizar")
  } finally {
    client.release()
  }
}


exports.cambiarEstatus = async (req, res) => {
  try {
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })
    if (!ROLES_TODAS_DEPENDENCIAS.includes(u.rol)) {
      return res.status(403).json({ error: "Solo Planeación puede cambiar el estatus." })
    }
    const estatus = String(req.body?.estatus || "")
    if (!ESTATUS.includes(estatus)) return res.status(400).json({ error: `Estatus inválido. Usa: ${ESTATUS.join(", ")}.` })

    const r = await pool.query(
      `UPDATE programas_presupuestarios SET estatus = $1, updated_by = $2, updated_at = NOW()
        WHERE id = $3 RETURNING id, estatus`,
      [estatus, u.id, req.params.id]
    )
    if (!r.rows[0]) return res.status(404).json({ error: "Programa presupuestario no encontrado." })
    await pool.query(
      `UPDATE pp_identificacion_general SET estatus = $1, updated_by = $2, updated_at = NOW()
        WHERE programa_id = $3`,
      [estatus, u.id, req.params.id]
    )
    res.json(r.rows[0])
  } catch (e) {
    if (e.code === "22P02") return res.status(400).json({ error: "Identificador inválido." })
    console.error("[PP] cambiarEstatus:", e)
    res.status(500).json({ error: "No se pudo cambiar el estatus." })
  }
}


exports.eliminar = async (req, res) => {
  try {
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })
    if (!puedeEscribir(u)) return res.status(403).json({ error: "Tu rol no puede eliminar programas presupuestarios." })

    const actual = await pool.query(
      "SELECT dependency_id, estatus FROM programas_presupuestarios WHERE id = $1",
      [req.params.id]
    )
    if (!actual.rows[0]) return res.status(404).json({ error: "Programa presupuestario no encontrado." })

    if (ROLES_DEPENDENCIA.includes(u.rol)) {
      if (!esMisma(u, actual.rows[0].dependency_id)) {
        return res.status(403).json({ error: "Solo puedes eliminar programas de tu dependencia." })
      }
      if (actual.rows[0].estatus !== "borrador") {
        return res.status(409).json({ error: "Solo se pueden eliminar programas en borrador." })
      }
    }

    await pool.query("DELETE FROM programas_presupuestarios WHERE id = $1", [req.params.id])
    res.json({ ok: true })
  } catch (e) {
    if (e.code === "22P02") return res.status(400).json({ error: "Identificador inválido." })
    console.error("[PP] eliminar:", e)
    res.status(500).json({ error: "No se pudo eliminar el programa presupuestario." })
  }
}
