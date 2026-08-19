const pool = require("../../../database/postgres")

exports.buscar = async (req, res) => {
  try {
    const q     = req.query.q || ""
    const zona  = req.query.zona || null
    const limit = parseInt(req.query.limit) || 10

    if (!q || q.trim().length < 2) {
      return res.json([])
    }

    const busq = q.toLowerCase()
      .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i')
      .replace(/ó/g,'o').replace(/ú/g,'u').replace(/ñ/g,'n')

    let where  = `WHERE activa=TRUE AND nombre_busqueda ILIKE $1`
    const params = [`%${busq}%`]

    if (zona) { params.push(zona); where += ` AND zona=$${params.length}` }

    const r = await pool.query(`
      SELECT id, nombre, cp, zona, lat, lng, geocodificada
      FROM cat_colonias_tuxtla
      ${where}
      ORDER BY
        CASE WHEN nombre_busqueda ILIKE $1 THEN 0 ELSE 1 END,
        nombre ASC
      LIMIT ${limit}
    `, params)

    res.json(r.rows)
  } catch(e) {
    console.error("Error buscando colonias:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.listar = async (req, res) => {
  try {
    const zona = req.query.zona || null
    let where  = "WHERE activa=TRUE"
    const params = []
    if (zona) { params.push(zona); where += ` AND zona=$1` }

    const r = await pool.query(`
      SELECT id, nombre, cp, zona, lat, lng
      FROM cat_colonias_tuxtla
      ${where}
      ORDER BY zona, nombre
    `, params)

    const porZona = {}
    r.rows.forEach(c => {
      if (!porZona[c.zona]) porZona[c.zona] = []
      porZona[c.zona].push(c)
    })

    res.json({ colonias: r.rows, por_zona: porZona, total: r.rows.length })
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.getZonas = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT DISTINCT zona, COUNT(*)::int as total
      FROM cat_colonias_tuxtla WHERE activa=TRUE
      GROUP BY zona ORDER BY zona
    `)
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.agregar = async (req, res) => {
  try {
    const { nombre, cp, zona, lat, lng } = req.body
    if (!nombre?.trim()) return res.status(400).json({ error: "Nombre requerido" })

    const nombre_busqueda = nombre.toLowerCase()
      .replace(/á/g,'a').replace(/é/g,'e').replace(/í/g,'i')
      .replace(/ó/g,'o').replace(/ú/g,'u').replace(/ñ/g,'n')

    const r = await pool.query(`
      INSERT INTO cat_colonias_tuxtla
        (nombre, nombre_busqueda, cp, zona, lat, lng, geocodificada)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT DO NOTHING
      RETURNING *
    `, [nombre.trim(), nombre_busqueda, cp||null, zona||"Centro",
        lat||null, lng||null, !!(lat&&lng)])

    res.json(r.rows[0] || { ok:false, msg:"Ya existe" })
  } catch(e) { res.status(500).json({ error: e.message }) }
}