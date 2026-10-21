const pool = require("../../../database/postgres");

exports.crearLineaAccion = async (req, res) => {
  try {
    const { alineacion_id, descripcion, dependencia_id } = req.body;

    if (!alineacion_id || !descripcion || !dependencia_id) {
      return res.status(400).json({ error: "Faltan datos obligatorios" });
    }

    // 1. Obtener el prefijo de la estrategia y su administración desde la alineacion
    const alineacionRes = await pool.query(
      "SELECT estrategia, administracion FROM nueva_alineacion WHERE id = $1",
      [alineacion_id]
    );

    if (alineacionRes.rowCount === 0) {
      return res.status(404).json({ error: "Alineación no encontrada" });
    }

    const { estrategia: estrategiaCompleta, administracion } = alineacionRes.rows[0];
    const match = estrategiaCompleta.match(/^(\d+(\.\d+)+)\.?\s/);
    let prefijo = "";
    if (match) {
        prefijo = match[1] + ".";
    } else {
        // Fallback: take first word if it contains numbers
        prefijo = estrategiaCompleta.split(' ')[0];
        if (!prefijo.endsWith('.')) prefijo += '.';
    }

    // 2. Contar cuántas líneas de acción existen bajo ese prefijo EN ESA ADMINISTRACIÓN
    const countRes = await pool.query(
      `SELECT COUNT(*) as total 
       FROM lineas_accion la
       JOIN nueva_alineacion na ON la.alineacion_id = na.id
       WHERE la.nomenclatura LIKE $1 AND na.administracion = $2`,
      [prefijo + '%', administracion]
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
    const { dependencia_id } = req.query; // to filter

    const alineacionRes = await pool.query(
      "SELECT estrategia, administracion FROM nueva_alineacion WHERE id = $1",
      [alineacion_id]
    );

    if (alineacionRes.rowCount === 0) {
      return res.status(404).json({ error: "Alineación no encontrada" });
    }

    const { estrategia: estrategiaCompleta, administracion } = alineacionRes.rows[0];

    const match = estrategiaCompleta.match(/^(\d+(\.\d+)+)\.?\s/);
    let prefijo = "";
    if (match) {
        prefijo = match[1] + ".";
    } else {
        prefijo = estrategiaCompleta.split(' ')[0];
        if (!prefijo.endsWith('.')) prefijo += ".";
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) as total 
       FROM lineas_accion la
       JOIN nueva_alineacion na ON la.alineacion_id = na.id
       WHERE la.nomenclatura LIKE $1 AND na.administracion = $2`,
      [prefijo + '%', administracion]
    );
    const count = parseInt(countRes.rows[0].total) || 0;
    const nextNumber = (count + 1).toString().padStart(2, '0');
    const nextNomenclatura = `${prefijo}${nextNumber}`;

    let queryParams = [estrategiaCompleta, administracion];
    let depFilter = "";
    if (dependencia_id) {
      depFilter = " AND la.dependencia_id = $3 ";
      queryParams.push(dependencia_id);
    }

    const result = await pool.query(
      `SELECT la.*, d.name as dependencia_nombre 
       FROM lineas_accion la
       JOIN nueva_alineacion na ON la.alineacion_id = na.id
       JOIN dependencies d ON la.dependencia_id = d.id
       WHERE na.estrategia = $1 AND na.administracion = $2 ${depFilter}
       ORDER BY la.nomenclatura ASC`,
      queryParams
    );

    res.json({
      lineas: result.rows,
      nextNomenclatura
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Error" });
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
    
    if (linea.rows[0].estado === 'validada') {
       return res.status(400).json({ error: "No se puede eliminar una línea de acción que ya ha sido validada." });
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

exports.actualizarLineaAccion = async (req, res) => {
  try {
    const { id } = req.params;
    const { descripcion, dependencia_id } = req.body;

    if (!descripcion || !descripcion.trim()) {
      return res.status(400).json({ error: "La descripción es requerida" });
    }

    const check = await pool.query("SELECT * FROM lineas_accion WHERE id = $1", [id]);
    if (check.rowCount === 0) {
      return res.status(404).json({ error: "Línea de acción no encontrada" });
    }

    const linea = check.rows[0];

    if (dependencia_id && linea.dependencia_id !== dependencia_id) {
      return res.status(403).json({ error: "No tienes permiso para editar esta línea de acción" });
    }

    if (linea.estado === 'validada') {
      return res.status(400).json({ error: "No se puede editar una línea de acción que ya ha sido validada" });
    }

    const result = await pool.query(
      `UPDATE lineas_accion 
       SET descripcion = $1, estado = 'pendiente', motivo_rechazo = NULL 
       WHERE id = $2 
       RETURNING *`,
      [descripcion.trim(), id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error al actualizar línea de acción:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

exports.cambiarEstadoLinea = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, motivo_rechazo } = req.body;

    if (!['validada', 'rechazada', 'pendiente'].includes(estado)) {
      return res.status(400).json({ error: "Estado no válido. Use 'validada', 'rechazada' o 'pendiente'" });
    }

    const check = await pool.query("SELECT * FROM lineas_accion WHERE id = $1", [id]);
    if (check.rowCount === 0) {
      return res.status(404).json({ error: "Línea de acción no encontrada" });
    }

    const result = await pool.query(
      `UPDATE lineas_accion 
       SET estado = $1, motivo_rechazo = $2 
       WHERE id = $3 
       RETURNING *`,
      [estado, motivo_rechazo || null, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error al cambiar estado de línea de acción:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
