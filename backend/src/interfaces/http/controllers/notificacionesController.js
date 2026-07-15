const pool = require('../../../database/postgres');

exports.getNotificaciones = async (req, res) => {
  try {
    const { user_id, dependency_id } = req.query;
    
    if (!user_id && !dependency_id) {
      return res.json([]);
    }

    const values = [];
    let query = 'SELECT * FROM notifications WHERE ';

    if (dependency_id && user_id) {
       query += '(dependency_id = $1 OR user_id = $2)';
       values.push(dependency_id, user_id);
    } else if (dependency_id) {
       query += 'dependency_id = $1';
       values.push(dependency_id);
    } else if (user_id) {
       query += 'user_id = $1';
       values.push(user_id);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.error("Error getting notificaciones:", error);
    res.status(500).json({ error: "Error al obtener notificaciones" });
  }
};

exports.marcarLeida = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE notifications SET leida = true WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notificacion:", error);
    res.status(500).json({ error: "Error al actualizar notificacion" });
  }
};

exports.marcarTodasLeidas = async (req, res) => {
  try {
    const { user_id, dependency_id } = req.body;
    if (!user_id && !dependency_id) return res.json({ success: true });
    
    const values = [];
    let query = 'UPDATE notifications SET leida = true WHERE ';

    if (dependency_id && user_id) {
       query += '(dependency_id = $1 OR user_id = $2)';
       values.push(dependency_id, user_id);
    } else if (dependency_id) {
       query += 'dependency_id = $1';
       values.push(dependency_id);
    } else if (user_id) {
       query += 'user_id = $1';
       values.push(user_id);
    }

    await pool.query(query, values);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking all notificaciones:", error);
    res.status(500).json({ error: "Error al actualizar notificaciones" });
  }
};
