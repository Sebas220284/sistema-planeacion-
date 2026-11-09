
const pool = require("../../../database/postgres")

const ROLES_TODAS_DEPENDENCIAS = ["admin", "planeacion", "planeacion_estrategica"] // editan cualquier programa
const ROLES_DEPENDENCIA = ["dependencias"] 

async function contextoUsuario(req) {
  const id = req.user?.id || req.user?.userId || req.user?.sub
  if (!id) return null
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.dependency_id, u.dependency_position, r.name AS rol
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1`,
    [id]
  )
  return rows[0] || null
}

const puedeEscribir = (u) => ROLES_TODAS_DEPENDENCIAS.includes(u.rol) || ROLES_DEPENDENCIA.includes(u.rol)
const veTodo = (u) => !ROLES_DEPENDENCIA.includes(u.rol) 
const esMisma = (u, depId) => !!u.dependency_id && u.dependency_id === depId


const CAMPOS_TEXTO = [
  "nombre", "clave_programatica", "modalidad_programatica", "unidad_responsable", "area_ejecutora",
  "responsable_integracion", "cargo", "correo_institucional", "telefono_institucional",
  "problematica_publica", "diagnostico_general", "justificacion_intervencion",
  "eje_rector", "eje_transversal", "politica_publica", "objetivo_estrategico", "estrategia", "linea_accion", "ods",
  "objetivo_institucional", "resultado_esperado", "contribucion_programa",
  "objetivo_general",
  "poblacion_potencial", "poblacion_objetivo", "poblacion_atendida_estimada", "metodo_cuantificacion", "fuente_informacion",
  "municipio", "localidades_beneficiadas", "colonias_beneficiadas", "cobertura_urbana", "cobertura_rural",
  "supuesto_estrategico", "supuesto_operativo", "supuesto_financiero", "supuesto_externo",
]
const CAMPOS_BOOL = ["usa_mir", "usa_fime", "usa_fiseg"]
const CAMPOS_OTROS = ["dependency_id", "strategy_id", "ejercicio_fiscal", "fecha_elaboracion", "estatus"]

const DIMENSIONES = ["Eficacia", "Eficiencia", "Calidad", "Economía"]
const ESTATUS = ["borrador", "en_revision", "validado", "rechazado"]

const vacioANull = (v) => {
  if (v === undefined) return undefined
  if (v === null) return null
  if (typeof v === "string") {
    const t = v.trim()
    return t === "" ? null : t
  }
  return v
}

function extraerCampos(body) {
  const out = {}
  for (const c of CAMPOS_TEXTO) if (c in body) out[c] = vacioANull(body[c])
  for (const c of CAMPOS_BOOL) if (c in body) out[c] = body[c] === true || body[c] === "true" || body[c] === 1
  for (const c of CAMPOS_OTROS) if (c in body) out[c] = vacioANull(body[c])
  return out
}

function validar(campos, hijos, esCreacion) {
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

function extraerHijos(body) {
  const h = {}
  const arr = (x) => (Array.isArray(x) ? x : null)

  const der = arr(body.programas_derivados)
  if (der) {
    h.programas_derivados = der
      .map((r) => ({ programa: vacioANull(r.programa), objetivo_vinculado: vacioANull(r.objetivo_vinculado) }))
      .filter((r) => r.programa)
  }
  const obj = arr(body.objetivos_especificos)
  if (obj) {
    h.objetivos_especificos = obj
      .map((r) => (typeof r === "string" ? vacioANull(r) : vacioANull(r?.objetivo)))
      .filter(Boolean)
  }
  const bys = arr(body.bienes_servicios)
  if (bys) {
    h.bienes_servicios = bys
      .map((r) => ({ bien_servicio: vacioANull(r.bien_servicio), unidad_medida: vacioANull(r.unidad_medida) }))
      .filter((r) => r.bien_servicio)
  }
  const ind = arr(body.indicadores)
  if (ind) {
    h.indicadores = ind
      .map((r) => ({
        nombre_indicador: vacioANull(r.nombre_indicador),
        dimension: vacioANull(r.dimension),
        frecuencia: vacioANull(r.frecuencia),
        meta_anual: vacioANull(r.meta_anual === undefined || r.meta_anual === null ? r.meta_anual : String(r.meta_anual)),
        medio_verificacion: vacioANull(r.medio_verificacion),
      }))
      .filter((r) => r.nombre_indicador)
  }
  return h
}

async function guardarHijos(client, programaId, h) {
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
    `SELECT pp.*, d.name AS dependencia
       FROM programas_presupuestarios pp
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


exports.listar = async (req, res) => {
  try {
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
        `SELECT pp.id, pp.nombre, pp.clave_programatica, pp.modalidad_programatica, pp.ejercicio_fiscal,
                pp.estatus, pp.dependency_id, d.name AS dependencia, pp.unidad_responsable,
                pp.fecha_elaboracion, pp.updated_at
           FROM programas_presupuestarios pp
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
  const client = await pool.connect()
  try {
    const u = await contextoUsuario(req)
    if (!u) return res.status(401).json({ error: "Usuario no válido." })
    if (!puedeEscribir(u)) return res.status(403).json({ error: "Tu rol no puede crear programas presupuestarios." })

    const campos = extraerCampos(req.body || {})
    const hijos = extraerHijos(req.body || {})

    if (ROLES_DEPENDENCIA.includes(u.rol)) {
      if (!u.dependency_id) return res.status(403).json({ error: "Tu usuario no tiene dependencia asignada." })
      campos.dependency_id = u.dependency_id
    }
    if (!ROLES_TODAS_DEPENDENCIAS.includes(u.rol)) campos.estatus = "borrador"

    const errores = validar(campos, hijos, true)
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
    await guardarHijos(client, id, hijos)
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

    const campos = extraerCampos(req.body || {})
    const hijos = extraerHijos(req.body || {})

    if (esDependencia) {
      delete campos.dependency_id 
      if (campos.estatus && !["borrador", "en_revision"].includes(campos.estatus)) delete campos.estatus
    }

    const errores = validar(campos, hijos, false)
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
    await guardarHijos(client, req.params.id, hijos)
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