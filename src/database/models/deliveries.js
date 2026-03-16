const { db } = require('../index');

const createOrUpdateDelivery = ({ orderId, channelId, userId, usernameSlug, approvedAt }) => {
  const existing = db.prepare('SELECT id FROM delivery_channels WHERE order_id = ?').get(orderId);
  if (existing) {
    return db.prepare(`
      UPDATE delivery_channels
      SET channel_id = ?, user_id = ?, username_slug = ?, approved_at = ?, status = 'aberto'
      WHERE order_id = ?
    `).run(channelId, userId, usernameSlug, approvedAt, orderId);
  }

  return db.prepare(`
    INSERT INTO delivery_channels (order_id, channel_id, user_id, username_slug, approved_at, status)
    VALUES (?, ?, ?, ?, ?, 'aberto')
  `).run(orderId, channelId, userId, usernameSlug, approvedAt);
};

const listOpenDeliveries = () => {
  return db
    .prepare("SELECT * FROM delivery_channels WHERE status = 'aberto' ORDER BY id DESC")
    .all();
};

const markDeliveryDone = (orderId) => {
  return db
    .prepare("UPDATE delivery_channels SET status = 'concluir' WHERE order_id = ?")
    .run(orderId);
};

module.exports = {
  createOrUpdateDelivery,
  listOpenDeliveries,
  markDeliveryDone
};
