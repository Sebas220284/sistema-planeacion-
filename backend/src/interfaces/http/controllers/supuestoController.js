const pool = require("../../../database/postgres")

const RE_CLAVE = /^\d+(\.\d+)+$/
const ROLES_EDICION = ["admin", "planeacion"]

async function rolDelUsuario(req) {
  const id = req.user?.id || req.user?.userId || req.user?.sub
  if (!id) return null
  const { rows } = await pool.query(
    `SELECT r.name AS rol FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
    [id]
  )
  return rows[0]?.rol || null
}

exports.soloPlaneacion = async (req, res, next) => {
  try {
    const rol = await rolDelUsuario(req)
    if (!ROLES_EDICION.includes(rol)) {
      return res.status(403).json({ error: "Solo Planeación puede modificar los supuestos." })
    }
    next()
  } catch (e) {
    console.error("[SUPUESTOS] Error verificando rol:", e)
    res.status(500).json({ error: "No se pudo verificar el permiso." })
  }
}

const limpiar = (t) => String(t ?? "").replace(/\s+/g, " ").trim()

function errorBD(res, e, accion) {
  if (e.code === "22P02") return res.status(400).json({ error: "Identificador inválido." })
  if (e.code === "23503") return res.status(400).json({ error: "La clave no existe en el catálogo de estrategias." })
  if (e.code === "23505") return res.status(409).json({ error: "Ya existe un supuesto con ese número de orden para esa estrategia." })
  console.error(`[SUPUESTOS] Error al ${accion}:`, e)
  return res.status(500).json({ error: `No se pudo ${accion} el supuesto.` })
}

function agrupar(rows) {
  const porClave = new Map()
  for (const r of rows) {
    if (!porClave.has(r.clave)) {
      porClave.set(r.clave, {
        strategy_id: r.strategy_id ?? null,
        estrategia: r.estrategia ?? null,
        clave: r.clave,
        indicador: r.indicador ?? null,
        supuestos: [],
      })
    }
    if (r.supuesto_id) {
      porClave.get(r.clave).supuestos.push({ id: r.supuesto_id, orden: r.orden, supuesto: r.supuesto })
    }
  }
  return [...porClave.values()]
}


exports.listar = async (req, res) => {
  try {
    const params = []
    const where = []
    if (req.query.q) {
      params.push(`%${String(req.query.q).trim()}%`)
      where.push(`(v.clave ILIKE $1 OR v.indicador ILIKE $1 OR v.supuesto ILIKE $1 OR v.estrategia ILIKE $1)`)
    }
    if (req.query.pendientes === "1") where.push("v.supuesto_id IS NULL")

    const { rows } = await pool.query(
      `SELECT v.strategy_id, v.estrategia, v.clave, v.indicador, v.supuesto_id, v.orden, v.supuesto
         FROM v_estrategia_supuesto v
         ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY string_to_array(v.clave, '.')::int[], v.orden`,
      params
    )
    res.json(agrupar(rows))
  } catch (e) {
    console.error("[SUPUESTOS] listar:", e)
    res.status(500).json({ error: "No se pudo obtener el catálogo de supuestos." })
  }
}

exports.porEstrategia = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT strategy_id, estrategia, clave, indicador, supuesto_id, orden, supuesto
         FROM v_estrategia_supuesto
        WHERE strategy_id = $1
        ORDER BY orden`,
      [req.params.strategy_id]
    )
    if (!rows.length) return res.status(404).json({ error: "Estrategia no encontrada." })
    res.json(agrupar(rows)[0])
  } catch (e) {
    if (e.code === "22P02") return res.status(400).json({ error: "Identificador inválido." })
    console.error("[SUPUESTOS] porEstrategia:", e)
    res.status(500).json({ error: "No se pudieron obtener los supuestos de la estrategia." })
  }
}

exports.porClave = async (req, res) => {
  try {
    const clave = String(req.params.clave || "").trim()
    if (!RE_CLAVE.test(clave)) return res.status(400).json({ error: "Clave inválida. Ejemplo: 6.2.1.4" })

    const { rows } = await pool.query(
      `SELECT v.strategy_id, v.estrategia, v.clave, v.indicador, v.supuesto_id, v.orden, v.supuesto
         FROM v_estrategia_supuesto v
        WHERE v.clave = $1
        ORDER BY v.orden`,
      [clave]
    )
    if (!rows.length) return res.status(404).json({ error: "Clave no encontrada en el catálogo." })
    res.json(agrupar(rows)[0])
  } catch (e) {
    console.error("[SUPUESTOS] porClave:", e)
    res.status(500).json({ error: "No se pudieron obtener los supuestos." })
  }
}

exports.crear = async (req, res) => {
  try {
    const clave = String(req.body?.clave || "").trim()
    const supuesto = limpiar(req.body?.supuesto)
    if (!RE_CLAVE.test(clave)) return res.status(400).json({ error: "Clave inválida. Ejemplo: 6.2.1.4" })
    if (!supuesto) return res.status(400).json({ error: "El supuesto no puede estar vacío." })
    if (supuesto.length > 1000) return res.status(400).json({ error: "El supuesto es demasiado largo (máx. 1000 caracteres)." })

    let orden = parseInt(req.body?.orden)
    if (!Number.isInteger(orden) || orden < 1) {
      const sig = await pool.query(
        "SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM estrategia_supuestos WHERE clave = $1",
        [clave]
      )
      orden = sig.rows[0].n
    }

    const { rows } = await pool.query(
      `INSERT INTO estrategia_supuestos (clave, orden, supuesto)
       VALUES ($1, $2, $3)
       RETURNING id, clave, orden, supuesto`,
      [clave, orden, supuesto]
    )
    res.status(201).json(rows[0])
  } catch (e) {
    errorBD(res, e, "crear")
  }
}

exports.actualizar = async (req, res) => {
  try {
    const sets = []
    const params = []
    if ("supuesto" in (req.body || {})) {
      const s = limpiar(req.body.supuesto)
      if (!s) return res.status(400).json({ error: "El supuesto no puede estar vacío." })
      if (s.length > 1000) return res.status(400).json({ error: "El supuesto es demasiado largo (máx. 1000 caracteres)." })
      params.push(s)
      sets.push(`supuesto = $${params.length}`)
    }
    if ("orden" in (req.body || {})) {
      const o = parseInt(req.body.orden)
      if (!Number.isInteger(o) || o < 1) return res.status(400).json({ error: "Orden inválido." })
      params.push(o)
      sets.push(`orden = $${params.length}`)
    }
    if (!sets.length) return res.status(400).json({ error: "No se envió ningún campo para actualizar." })

    params.push(req.params.id)
    const { rows } = await pool.query(
      `UPDATE estrategia_supuestos SET ${sets.join(", ")}, updated_at = NOW()
        WHERE id = $${params.length}
        RETURNING id, clave, orden, supuesto`,
      params
    )
    if (!rows[0]) return res.status(404).json({ error: "Supuesto no encontrado." })
    res.json(rows[0])
  } catch (e) {
    errorBD(res, e, "actualizar")
  }
}

exports.eliminar = async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM estrategia_supuestos WHERE id = $1", [req.params.id])
    if (!rowCount) return res.status(404).json({ error: "Supuesto no encontrado." })
    res.json({ ok: true })
  } catch (e) {
    errorBD(res, e, "eliminar")
  }
}