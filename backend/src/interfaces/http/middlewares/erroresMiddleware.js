const crypto = require("crypto")

const MENSAJE_500 = "Error interno del servidor. Si el problema continúa, informa a Planeación con esta referencia."


function ocultarErroresInternos(req, res, next) {
  const jsonOriginal = res.json.bind(res)

  res.json = (body) => {
    const esHealth = req.originalUrl.startsWith("/health")
    if (res.statusCode >= 500 && !esHealth && body && typeof body === "object") {
      const ref = crypto.randomBytes(4).toString("hex")
      const detalle = body.detalle_error || body.error || body.message || body
      console.error(`[ERROR ${ref}] ${req.method} ${req.originalUrl} (${res.statusCode}) →`, detalle)
      return jsonOriginal({ error: MENSAJE_500, ref })
    }
    return jsonOriginal(body)
  }
  next()
}

function rutaNoEncontrada(req, res) {
  res.status(404).json({ error: "Ruta no encontrada." })
}


function manejadorErrores(err, req, res, next) {
  if (res.headersSent) return next(err)

  if (err?.type === "entity.too.large") return res.status(413).json({ error: "El archivo o los datos enviados son demasiado grandes." })
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "El formato de los datos enviados no es válido." })

  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 500 ? err.status : 500
  if (status < 500) return res.status(status).json({ error: "Solicitud inválida." })

  const ref = crypto.randomBytes(4).toString("hex")
  console.error(`[ERROR ${ref}] ${req.method} ${req.originalUrl} →`, err)
  res.status(500).json({ error: MENSAJE_500, ref })
}

module.exports = { ocultarErroresInternos, rutaNoEncontrada, manejadorErrores }