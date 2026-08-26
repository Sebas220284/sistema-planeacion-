const pool = require("../../../database/postgres")
const fs = require("fs")
const path = require("path")

const MAX_BYTES = 2 * 1024 * 1024   // 2 MB

// Directorio donde se guardarán las fotos
const UPLOAD_DIR = "/home/evidencias";

// Asegurar que la carpeta exista al arrancar el servidor
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

exports.subir = async (req, res) => {
  try {
    const { id: proyecto_id } = req.params
    const {
      titulo, descripcion, seccion,
      imagen_base64, imagen_nombre, imagen_tipo, imagen_tamano,
      lat, lng, direccion,
      subido_por, subido_por_nombre
    } = req.body

    if (!imagen_base64) {
      return res.status(400).json({ error: "No se recibió ninguna imagen" })
    }

    const bytesAprox = imagen_tamano
      ? Number(imagen_tamano)
      : Math.round((imagen_base64.length * 3) / 4)

    if (bytesAprox > MAX_BYTES) {
      return res.status(400).json({
        error: `La imagen excede el límite de 2 MB (tamaño: ${(bytesAprox/1024/1024).toFixed(2)} MB)`
      })
    }

    // Extraer base64 crudo para validarlo y guardarlo
    const base64Data = imagen_base64.replace(/^data:image\/\w+;base64,/, "");

    // Verificación explícita de "Magic Number" (Firma binaria del archivo)
    // Esto evita que suban un .docx o .exe renombrado a .jpg
    const isJPG = base64Data.startsWith("/9j/");
    const isPNG = base64Data.startsWith("iVBORw0KGgo");
    const isWEBP = base64Data.startsWith("UklGR");

    if (!isJPG && !isPNG && !isWEBP) {
      return res.status(400).json({ error: "El archivo no es una imagen real válida, se detectó un formato falso." });
    }

    const tiposPermitidos = ["image/jpeg","image/jpg","image/png","image/webp"]
    if (imagen_tipo && !tiposPermitidos.includes(imagen_tipo.toLowerCase())) {
      return res.status(400).json({ error: "Solo se permiten imágenes JPG, PNG o WEBP" })
    }

    const proy = await pool.query(`SELECT id FROM cip_proyectos WHERE id=$1`, [proyecto_id])
    if (!proy.rows[0]) return res.status(404).json({ error: "Proyecto no encontrado" })

    // Renombrar el archivo para la Base de Datos preservando su extensión real
    const ext = imagen_tipo ? imagen_tipo.split('/')[1] : "jpg";
    const secureFileName = `Evidencia_${Date.now()}_${Math.round(Math.random()*1000)}.${ext}`;

    let datosAInsertar = imagen_base64;

    // Condicional: si existe la carpeta, guardar en archivo local
    if (fs.existsSync(UPLOAD_DIR)) {
      try {
        const filePath = path.join(UPLOAD_DIR, secureFileName);
        
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        
        datosAInsertar = `LOCAL_FILE:${secureFileName}`;
      } catch (err) {
        console.error("Error guardando archivo en carpeta, fallback a BD:", err);
      }
    }

    const r = await pool.query(`
      INSERT INTO cip_evidencias (
        proyecto_id, titulo, descripcion, seccion,
        imagen_base64, imagen_nombre, imagen_tipo, imagen_tamano,
        lat, lng, direccion,
        subido_por, subido_por_nombre
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id, proyecto_id, titulo, descripcion, seccion,
        imagen_nombre, imagen_tipo, imagen_tamano,
        lat, lng, direccion, subido_por_nombre, created_at
    `, [
      proyecto_id,
      titulo        || null,
      descripcion   || null,
      seccion       || "general",
      datosAInsertar,
      imagen_nombre || null,
      imagen_tipo   || null,
      bytesAprox,
      lat  ? Number(lat)  : null,
      lng  ? Number(lng)  : null,
      direccion     || null,
      subido_por    || null,
      subido_por_nombre || null
    ])

    req.app.get("io").emit("cip_nueva_evidencia", {
      proyecto_id,
      evidencia: r.rows[0]
    })

    res.json(r.rows[0])
  } catch(e) {
    console.error("Error subiendo evidencia:", e)
    res.status(500).json({ error: e.message })
  }
}

exports.listar = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, proyecto_id, titulo, descripcion, seccion,
        imagen_nombre, imagen_tipo,
        ROUND(imagen_tamano::numeric / 1024, 1) AS tamano_kb,
        lat, lng, direccion,
        subido_por_nombre, created_at
      FROM cip_evidencias
      WHERE proyecto_id = $1
      ORDER BY created_at ASC
    `, [req.params.id])

    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.obtener = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT * FROM cip_evidencias WHERE id=$1
    `, [req.params.eid])

    if (!r.rows[0]) return res.status(404).json({ error: "Evidencia no encontrada" })
    
    const ev = r.rows[0];
    if (ev.imagen_base64 && ev.imagen_base64.startsWith("LOCAL_FILE:")) {
      const fileName = ev.imagen_base64.split(":")[1];
      const filePath = path.join(UPLOAD_DIR, fileName);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        const mime = ev.imagen_tipo || "image/jpeg";
        ev.imagen_base64 = `data:${mime};base64,${fileBuffer.toString('base64')}`;
      }
    }

    res.json(ev)
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.actualizar = async (req, res) => {
  try {
    const { titulo, descripcion, seccion, lat, lng, direccion } = req.body
    const r = await pool.query(`
      UPDATE cip_evidencias
      SET titulo=$1, descripcion=$2, seccion=$3,
          lat=$4, lng=$5, direccion=$6
      WHERE id=$7
      RETURNING id, titulo, descripcion, seccion, lat, lng, direccion
    `, [
      titulo||null, descripcion||null, seccion||"general",
      lat ? Number(lat) : null, lng ? Number(lng) : null,
      direccion||null, req.params.eid
    ])
    if (!r.rows[0]) return res.status(404).json({ error: "No encontrada" })
    res.json(r.rows[0])
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.eliminar = async (req, res) => {
  try {
    const r = await pool.query(`SELECT imagen_base64 FROM cip_evidencias WHERE id=$1`, [req.params.eid])
    if (r.rows[0] && r.rows[0].imagen_base64 && r.rows[0].imagen_base64.startsWith("LOCAL_FILE:")) {
      const fileName = r.rows[0].imagen_base64.split(":")[1];
      const filePath = path.join(UPLOAD_DIR, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query(`DELETE FROM cip_evidencias WHERE id=$1`, [req.params.eid])
    res.json({ ok: true })
  } catch(e) { res.status(500).json({ error: e.message }) }
}

exports.resumen = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        seccion,
        COUNT(*)::int AS total,
        COUNT(lat)::int AS con_georef,
        SUM(imagen_tamano)::int AS bytes_total
      FROM cip_evidencias
      WHERE proyecto_id = $1
      GROUP BY seccion
    `, [req.params.id])
    res.json(r.rows)
  } catch(e) { res.status(500).json({ error: e.message }) }
}
