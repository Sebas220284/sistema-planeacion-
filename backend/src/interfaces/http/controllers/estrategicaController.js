const pool = require("../../../database/postgres");

exports.crearPlaneacion = async (req, res) => {
  try {
    const { eje_pmd, tema, politica_publica, objetivo, estrategia, dependencia_id, administracion } = req.body;

    const result = await pool.query(
      `INSERT INTO nueva_alineacion 
        (eje_pmd, tema, politica_publica, objetivo, estrategia, administracion, dependencia_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [eje_pmd, tema, politica_publica, objetivo, estrategia, administracion || '2024-2027', dependencia_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error al crear planeaciÃ³n estratÃ©gica:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

exports.obtenerEjes = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT eje_pmd FROM nueva_alineacion WHERE eje_pmd IS NOT NULL ORDER BY eje_pmd`
    );
    // Returns array of objects like { eje_pmd: "Eje 1..." }
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener ejes PMD:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

exports.obtenerAlineacionPorDependencia = async (req, res) => {
  try {
    const { dependencia_id } = req.params;
    const result = await pool.query(
      `SELECT 
         n.id, n.eje_pmd, n.tema, n.politica_publica, n.objetivo, n.estrategia, n.administracion, n.created_at,
         (
           SELECT array_agg(d.name)
           FROM nueva_alineacion n2
           JOIN dependencies d ON d.id = n2.dependencia_id
           WHERE n2.estrategia = n.estrategia AND n2.dependencia_id != $1
         ) as compartida_con,
         (
           SELECT coalesce(json_agg(json_build_object(
             'id', la.id,
             'nomenclatura', la.nomenclatura,
             'descripcion', la.descripcion,
             'dependencia_nombre', d3.name
           ) ORDER BY la.nomenclatura ASC), '[]'::json)
           FROM lineas_accion la
           JOIN dependencies d3 ON d3.id = la.dependencia_id
           JOIN nueva_alineacion na ON na.id = la.alineacion_id
           WHERE na.estrategia = n.estrategia
         ) as lineas
       FROM nueva_alineacion n
       WHERE n.dependencia_id = $1 
       ORDER BY n.created_at DESC`,
      [dependencia_id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener alineaciÃ³n de dependencia:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

exports.obtenerEstrategiasExistentes = async (req, res) => {
  try {
    const { administracion } = req.query;
    if (!administracion) {
      return res.status(400).json({ error: "Falta parámetro administracion" });
    }
    const result = await pool.query(
      `SELECT DISTINCT estrategia, eje_pmd, tema, politica_publica, objetivo 
       FROM nueva_alineacion 
       WHERE administracion = $1
       ORDER BY estrategia ASC`,
      [administracion]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener estrategias existentes:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
