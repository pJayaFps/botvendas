const { db } = require('../index');

const createOrder = (userId, items, total, status = 'PENDENTE') => {
  const createdAt = new Date().toISOString();
  const orderResult = db.prepare('INSERT INTO orders (user_id, total, status, created_at) VALUES (?, ?, ?, ?)').run(userId, total, status, createdAt);
  const fallback = db
    .prepare('SELECT id FROM orders WHERE user_id = ? AND created_at = ? ORDER BY id DESC LIMIT 1')
    .get(userId, createdAt);
  const orderId = orderResult.lastInsertRowid || fallback?.id;
  const insertItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
  items.forEach((item) => insertItem.run(orderId, item.product_id, item.quantity, item.price));
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
};

const listOrders = () => db.prepare('SELECT * FROM orders ORDER BY id DESC').all();

const listOrderItems = (orderId) => {
  return db.prepare(`
    SELECT order_items.*, products.name
    FROM order_items
    JOIN products ON products.id = order_items.product_id
    WHERE order_items.order_id = ?
  `).all(orderId);
};

const updateOrderStatus = (orderId, status) => {
  return db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
};

module.exports = { createOrder, listOrders, listOrderItems, updateOrderStatus };
