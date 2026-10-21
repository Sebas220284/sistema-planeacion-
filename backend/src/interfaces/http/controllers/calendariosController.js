const pool = require("../../../database/postgres");
const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;

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
    const rows = r.rows.map(c => ({
      ...c,
      enero: round2(c.enero), febrero: round2(c.febrero), marzo: round2(c.marzo),
      abril: round2(c.abril), mayo: round2(c.mayo), junio: round2(c.junio),
      julio: round2(c.julio), agosto: round2(c.agosto), septiembre: round2(c.septiembre),
      octubre: round2(c.octubre), noviembre: round2(c.noviembre), diciembre: round2(c.diciembre),
      total: round2(c.total)
    }));
    res.json(rows);
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
      round2(enero), round2(febrero), round2(marzo), round2(abril), round2(mayo), round2(junio), 
      round2(julio), round2(agosto), round2(septiembre), round2(octubre), round2(noviembre), round2(diciembre)
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
      round2(enero), round2(febrero), round2(marzo), round2(abril), round2(mayo), round2(junio), 
      round2(julio), round2(agosto), round2(septiembre), round2(octubre), round2(noviembre), round2(diciembre), 
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
