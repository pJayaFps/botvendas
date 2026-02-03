const { db } = require('../index');

const createPayment = (data) => {
  const stmt = db.prepare(`
    INSERT INTO payments (order_id, payment_id, provider, user_id, ticket_channel_id, product_name, amount, payload, status, created_at)
    VALUES (@order_id, @payment_id, @provider, @user_id, @ticket_channel_id, @product_name, @amount, @payload, @status, @created_at)
  `);
  const result = stmt.run(data);
  if (result.lastInsertRowid) return result.lastInsertRowid;
  const fallback = db.prepare('SELECT id FROM payments ORDER BY id DESC LIMIT 1').get();
  return fallback?.id;
};

const getPaymentByPaymentId = (paymentId) => {
  return db.prepare('SELECT * FROM payments WHERE payment_id = ?').get(paymentId);
};

const updatePaymentStatus = (paymentId, status) => {
  return db.prepare('UPDATE payments SET status = ? WHERE payment_id = ?').run(status, paymentId);
};

module.exports = { createPayment, getPaymentByPaymentId, updatePaymentStatus };
