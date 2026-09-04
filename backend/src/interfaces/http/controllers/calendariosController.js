const pool = require("../../../database/postgres");

const initCalendarioTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cip_calendario (
      id SERIAL PRIMARY KEY,
      proyecto_id UUID NOT NULL REFERENCES cip_proyectos(id) ON DELETE CASCADE,
      desglose_id UUID NOT NULL REFERENCES cip_desglose_presupuesto(id) ON DELETE CASCADE,
      enero NUMERIC(15,2) DEFAULT 0,
      febrero NUMERIC(15,2) DEFAULT 0,
      marzo NUMERIC(15,2) DEFAULT 0,
      abril NUMERIC(15,2) DEFAULT 0,
      mayo NUMERIC(15,2) DEFAULT 0,
      junio NUMERIC(15,2) DEFAULT 0,
      julio NUMERIC(15,2) DEFAULT 0,
      agosto NUMERIC(15,2) DEFAULT 0,
      septiembre NUMERIC(15,2) DEFAULT 0,
      octubre NUMERIC(15,2) DEFAULT 0,
      noviembre NUMERIC(15,2) DEFAULT 0,
      diciembre NUMERIC(15,2) DEFAULT 0,
      total NUMERIC(15,2) GENERATED ALWAYS AS (
        COALESCE(enero, 0) + COALESCE(febrero, 0) + COALESCE(marzo, 0) + COALESCE(abril, 0) + 
        COALESCE(mayo, 0) + COALESCE(junio, 0) + COALESCE(julio, 0) + COALESCE(agosto, 0) + 
        COALESCE(septiembre, 0) + COALESCE(octubre, 0) + COALESCE(noviembre, 0) + COALESCE(diciembre, 0)
      ) STORED
    );
  `);
};

exports.getCalendario = async (req, res) => {
  try {
    await initCalendarioTable();
    const r = await pool.query(`
      SELECT c.*, d.partida_clave, d.descripcion as partida_descripcion 
      FROM cip_calendario c
      JOIN cip_desglose_presupuesto d ON c.desglose_id = d.id
      WHERE c.proyecto_id=$1 
      ORDER BY c.id
    `, [req.params.id]);
    res.json(r.rows);
  } catch(e) { res.status(500).json({ error: e.message }) }
};

exports.agregarCalendario = async (req, res) => {
  try {
    await initCalendarioTable();
    const { 
      desglose_id, enero, febrero, marzo, abril, mayo, junio, 
      julio, agosto, septiembre, octubre, noviembre, diciembre 
    } = req.body;
    const r = await pool.query(`
      INSERT INTO cip_calendario
        (proyecto_id, desglose_id, enero, febrero, marzo, abril, mayo, junio, julio, agosto, septiembre, octubre, noviembre, diciembre)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *
    `, [
      req.params.id, desglose_id, 
      enero||0, febrero||0, marzo||0, abril||0, mayo||0, junio||0, 
      julio||0, agosto||0, septiembre||0, octubre||0, noviembre||0, diciembre||0
    ]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }) }
};

exports.actualizarCalendario = async (req, res) => {
  try {
    const { 
      enero, febrero, marzo, abril, mayo, junio, 
      julio, agosto, septiembre, octubre, noviembre, diciembre 
    } = req.body;
    const r = await pool.query(`
      UPDATE cip_calendario
      SET enero=$1, febrero=$2, marzo=$3, abril=$4, mayo=$5, junio=$6,
          julio=$7, agosto=$8, septiembre=$9, octubre=$10, noviembre=$11, diciembre=$12
      WHERE id=$13 RETURNING *
    `, [
      enero||0, febrero||0, marzo||0, abril||0, mayo||0, junio||0, 
      julio||0, agosto||0, septiembre||0, octubre||0, noviembre||0, diciembre||0, 
      req.params.cid
    ]);
    res.json(r.rows[0]);
  } catch(e) { res.status(500).json({ error: e.message }) }
};

exports.eliminarCalendario = async (req, res) => {
  try {
    await pool.query('DELETE FROM cip_calendario WHERE id=$1', [req.params.cid]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }) }
};
