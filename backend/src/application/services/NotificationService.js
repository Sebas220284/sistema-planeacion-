const pool = require('../../database/postgres');

class NotificationService {
  static async sendNotification(io, data, rooms) {
    try {
      const { user_id, dependency_id, tipo, titulo, mensaje, link } = data;

      const result = await pool.query(
        `INSERT INTO notifications (user_id, dependency_id, tipo, titulo, mensaje, link) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [user_id || null, dependency_id || null, tipo, titulo, mensaje, link || null]
      );

      const notif = result.rows[0];

      if (io && rooms) {
        if (Array.isArray(rooms)) {
          rooms.forEach(room => io.to(room).emit('nueva_notificacion', notif));
        } else {
          io.to(rooms).emit('nueva_notificacion', notif);
        }
      }

      return notif;
    } catch (error) {
      console.error("Error al enviar notificación:", error);
      throw error;
    }
  }
}

module.exports = NotificationService;
