const pool = require("../../../database/postgres")

// ── Helper: extrae info del user-agent ──
const parsearDispositivo = (userAgent = "") => {
  const ua = userAgent.toLowerCase()

  // Sistema operativo
  let so = "Desconocido"
  if (ua.includes("windows nt 10")) so = "Windows 10/11"
  else if (ua.includes("windows nt 6.3")) so = "Windows 8.1"
  else if (ua.includes("windows nt 6.1")) so = "Windows 7"
  else if (ua.includes("windows"))        so = "Windows"
  else if (ua.includes("mac os"))         so = "macOS"
  else if (ua.includes("android"))        so = "Android"
  else if (ua.includes("iphone"))         so = "iPhone"
  else if (ua.includes("ipad"))           so = "iPad"
  else if (ua.includes("linux"))          so = "Linux"

  let nav = "Desconocido"
  if (ua.includes("edg/"))         nav = "Microsoft Edge"
  else if (ua.includes("chrome/")) nav = "Google Chrome"
  else if (ua.includes("firefox/")) nav = "Firefox"
  else if (ua.includes("safari/") && !ua.includes("chrome")) nav = "Safari"
  else if (ua.includes("opera/") || ua.includes("opr/")) nav = "Opera"

  let disp = "Computadora"
  if (ua.includes("mobile"))  disp = "Móvil"
  else if (ua.includes("tablet") || ua.includes("ipad")) disp = "Tablet"

  return { so, nav, disp }
}

const obtenerIP = (req) => {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.headers["x-real-ip"]
    || req.connection?.remoteAddress
    || req.socket?.remoteAddress
    || "0.0.0.0"
}


exports.registrar = async ({
  user_id, user_name, user_email, rol_nombre,
  ip_address, user_agent, accion = "login",
  descripcion, ruta, exitoso = true, detalle_error
}) => {
  try {
    const { so, nav, disp } = parsearDispositivo(user_agent)
    await pool.query(`
      INSERT INTO audit_logs (
        user_id, user_name, user_email, rol_nombre,
        ip_address, user_agent, dispositivo, navegador, sistema_operativo,
        accion, descripcion, ruta, exitoso, detalle_error
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    `, [
      user_id||null, user_name||null, user_email||null, rol_nombre||null,
      ip_address||null, user_agent?.substring(0,500)||null,
      disp, nav, so,
      accion, descripcion||null, ruta||null,
      exitoso, detalle_error||null
    ])
  } catch(e) {
    console.error("Error guardando audit log:", e.message)
  }
}


exports.listar = async (req, res) => {
  try {
    const {
      pagina    = 1,
      limite    = 50,
      user_id,
      accion,
      exitoso,
      ip,
      fecha_inicio,
      fecha_fin,
      busqueda
    } = req.query

    let where   = "WHERE 1=1"
    const params = []

    if (user_id) {
      params.push(user_id)
      where += ` AND user_id=$${params.length}`
    }
    if (accion) {
      params.push(accion)
      where += ` AND accion=$${params.length}`
    }
    if (exitoso !== undefined && exitoso !== "") {
      params.push(exitoso === "true")
      where += ` AND exitoso=$${params.length}`
    }
    if (ip) {
      params.push(`%${ip}%`)
      where += ` AND ip_address ILIKE $${params.length}`
    }
    if (fecha_inicio) {
      params.push(fecha_inicio)
      where += ` AND created_at >= $${params.length}::date`
    }
    if (fecha_fin) {
      params.push(fecha_fin)
      where += ` AND created_at <= ($${params.length}::date + INTERVAL '1 day')`
    }
    if (busqueda) {
      params.push(`%${busqueda}%`)
      where += ` AND (
        user_name ILIKE $${params.length} OR
        user_email ILIKE $${params.length} OR
        ip_address ILIKE $${params.length} OR
        descripcion ILIKE $${params.length}
      )`
    }

    const offset = (Number(pagina) - 1) * Number(limite)
    const total  = await pool.query(
      `SELECT COUNT(*) FROM audit_logs ${where}`, params
    )

    const r = await pool.query(`
      SELECT * FROM audit_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT $${params.length+1} OFFSET $${params.length+2}
    `, [...params, Number(limite), offset])

    res.json({
      logs:          r.rows,
      total:         parseInt(total.rows[0].count),
      pagina:        Number(pagina),
      total_paginas: Math.ceil(parseInt(total.rows[0].count) / Number(limite))
    })
  } catch(e) {
    console.error("Error listando logs:", e)
    res.status(500).json({ error: e.message })
  }
}


exports.getStats = async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*)::int                                                AS total_conexiones,
        COUNT(*) FILTER (WHERE exitoso=TRUE)::int                   AS exitosas,
        COUNT(*) FILTER (WHERE exitoso=FALSE)::int                  AS fallidas,
        COUNT(DISTINCT user_id)                                      AS usuarios_unicos,
        COUNT(DISTINCT ip_address)                                   AS ips_unicas,
        COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '24h')::int AS hoy,
        COUNT(*) FILTER (WHERE created_at >= NOW()-INTERVAL '7d')::int  AS esta_semana
      FROM audit_logs
      WHERE accion = 'login'
    `)

    const topUsuarios = await pool.query(`
      SELECT user_name, user_email, rol_nombre,
        COUNT(*)::int AS conexiones,
        MAX(created_at) AS ultima_conexion,
        COUNT(DISTINCT ip_address)::int AS ips_distintas
      FROM audit_logs
      WHERE accion='login' AND exitoso=TRUE AND user_id IS NOT NULL
      GROUP BY user_name, user_email, rol_nombre
      ORDER BY conexiones DESC
      LIMIT 10
    `)

    const topIPs = await pool.query(`
      SELECT ip_address,
        COUNT(*)::int AS conexiones,
        COUNT(DISTINCT user_id)::int AS usuarios_distintos,
        MAX(created_at) AS ultima_vez,
        bool_or(NOT exitoso) AS tuvo_fallo
      FROM audit_logs
      WHERE accion='login'
      GROUP BY ip_address
      ORDER BY conexiones DESC
      LIMIT 10
    `)

    const porHora = await pool.query(`
      SELECT
        DATE_TRUNC('hour', created_at) AS hora,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE exitoso=TRUE)::int  AS exitosas,
        COUNT(*) FILTER (WHERE exitoso=FALSE)::int AS fallidas
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY hora ORDER BY hora
    `)

    const porDia = await pool.query(`
      SELECT
        DATE_TRUNC('day', created_at)::date AS dia,
        COUNT(*)::int AS total,
        COUNT(DISTINCT user_id)::int AS usuarios_unicos
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND accion='login' AND exitoso=TRUE
      GROUP BY dia ORDER BY dia
    `)

    const porDispositivo = await pool.query(`
      SELECT dispositivo, COUNT(*)::int AS total
      FROM audit_logs WHERE accion='login' AND exitoso=TRUE
      GROUP BY dispositivo ORDER BY total DESC
    `)

    const porNavegador = await pool.query(`
      SELECT navegador, COUNT(*)::int AS total
      FROM audit_logs WHERE accion='login' AND exitoso=TRUE
      GROUP BY navegador ORDER BY total DESC
    `)

    res.json({
      stats:          stats.rows[0],
      top_usuarios:   topUsuarios.rows,
      top_ips:        topIPs.rows,
      por_hora:       porHora.rows,
      por_dia:        porDia.rows,
      por_dispositivo: porDispositivo.rows,
      por_navegador:  porNavegador.rows
    })
  } catch(e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}


exports.exportar = async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin, accion, exitoso } = req.query

    let where   = "WHERE 1=1"
    const params = []

    if (fecha_inicio) {
      params.push(fecha_inicio)
      where += ` AND created_at >= $${params.length}::date`
    }
    if (fecha_fin) {
      params.push(fecha_fin)
      where += ` AND created_at <= ($${params.length}::date + INTERVAL '1 day')`
    }
    if (accion) {
      params.push(accion)
      where += ` AND accion=$${params.length}`
    }
    if (exitoso !== undefined && exitoso !== "") {
      params.push(exitoso === "true")
      where += ` AND exitoso=$${params.length}`
    }

    const r = await pool.query(`
      SELECT
        user_name       AS "Nombre de usuario",
        user_email      AS "Email",
        rol_nombre      AS "Rol",
        ip_address      AS "Dirección IP",
        dispositivo     AS "Dispositivo",
        navegador       AS "Navegador",
        sistema_operativo AS "Sistema Operativo",
        accion          AS "Acción",
        descripcion     AS "Descripción",
        exitoso         AS "¿Exitoso?",
        detalle_error   AS "Error",
        TO_CHAR(created_at, 'DD/MM/YYYY HH24:MI:SS') AS "Fecha y hora"
      FROM audit_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT 10000
    `, params)

    res.json({ datos: r.rows, total: r.rows.length })
  } catch(e) { res.status(500).json({ error: e.message }) }
}