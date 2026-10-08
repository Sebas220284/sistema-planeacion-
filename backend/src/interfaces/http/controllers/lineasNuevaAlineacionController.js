const pool = require("../../../database/postgres");

exports.crearLineaAccion = async (req, res) => {
  try {
    const { alineacion_id, descripcion, dependencia_id } = req.body;

    if (!alineacion_id || !descripcion || !dependencia_id) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    // 1. Obtener el prefijo de la estrategia (por ejemplo, "3.3.1.3.") desde la alineacion
    const alineacionRes = await pool.query(
      "SELECT estrategia FROM nueva_alineacion WHERE id = $1",
      [alineacion_id]
    );

    if (alineacionRes.rowCount === 0) {
      return res.status(404).json({ error: "Alineación no encontrada" });
    }

    const estrategiaCompleta = alineacionRes.rows[0].estrategia;
    const match = estrategiaCompleta.match(/^(\d+(\.\d+)+)\.?\s/);
    let prefijo = "";
    if (match) {
        prefijo = match[1] + ".";
    } else {
        // Fallback: take first word if it contains numbers
        prefijo = estrategiaCompleta.split(' ')[0];
        if (!prefijo.endsWith('.')) prefijo += '.';
    }

    // 2. Contar cuántas líneas de acción ya existen bajo ese prefijo a nivel global
    const countRes = await pool.query(
      `SELECT COUNT(*) as total FROM lineas_accion 
       WHERE nomenclatura LIKE $1`,
      [prefijo + '%']
    );

    const count = parseInt(countRes.rows[0].total) || 0;
    const nextNumber = (count + 1).toString().padStart(2, '0');
    const nomenclatura = `${prefijo}${nextNumber}`;

    // 3. Insertar la nueva línea de acción
    const result = await pool.query(
      `INSERT INTO lineas_accion (alineacion_id, dependencia_id, nomenclatura, descripcion)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [alineacion_id, dependencia_id, nomenclatura, descripcion]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creando línea de acción:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

exports.obtenerLineasPorEstrategia = async (req, res) => {
  try {
    const { alineacion_id } = req.params;

    // Obtener el texto de la estrategia original
    const alineacionRes = await pool.query(
      "SELECT estrategia FROM nueva_alineacion WHERE id = $1",
      [alineacion_id]
    );

    if (alineacionRes.rowCount === 0) {
      return res.status(404).json({ error: "Alineación no encontrada" });
    }

    const estrategia = alineacionRes.rows[0].estrategia;

    // Buscar todas las lineas de todas las dependencias que comparten esta estrategia
    const result = await pool.query(
      `SELECT la.*, d.name as dependencia_nombre 
       FROM lineas_accion la
       JOIN nueva_alineacion na ON la.alineacion_id = na.id
       JOIN dependencies d ON la.dependencia_id = d.id
       WHERE na.estrategia = $1
       ORDER BY la.nomenclatura ASC`,
      [estrategia]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo líneas de acción:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

exports.eliminarLineaAccion = async (req, res) => {
  try {
    const { id } = req.params;
    const { dependencia_id } = req.query; 
    
    const linea = await pool.query("SELECT dependencia_id FROM lineas_accion WHERE id = $1", [id]);
    if (linea.rowCount === 0) {
       return res.status(404).json({ error: "No encontrada" });
    }
    
    // Only allow deletion if the request comes from the owner dependency
    if (dependencia_id && linea.rows[0].dependencia_id !== dependencia_id) {
       return res.status(403).json({ error: "No tienes permiso para eliminar esta línea" });
    }

    await pool.query("DELETE FROM lineas_accion WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error eliminando línea:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
