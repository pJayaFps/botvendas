const { db } = require('../index');

const getCustomer = (userId) => db.prepare('SELECT * FROM customers WHERE user_id = ?').get(userId);

const upsertCustomer = (userId, name) => {
  const existing = getCustomer(userId);
  if (existing) return existing;
  db.prepare('INSERT INTO customers (user_id, name, xp, level) VALUES (?, ?, 0, 1)').run(userId, name);
  return getCustomer(userId);
};

const addXp = (userId, xp) => {
  const customer = getCustomer(userId);
  const newXp = (customer?.xp || 0) + xp;
  const newLevel = Math.min(10, Math.floor(newXp / 100) + 1);
  db.prepare('UPDATE customers SET xp = ?, level = ? WHERE user_id = ?').run(newXp, newLevel, userId);
  return getCustomer(userId);
};

module.exports = { getCustomer, upsertCustomer, addXp };
