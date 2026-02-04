const { db } = require('../index');

const getCustomer = (userId, botId = 1) => db.prepare('SELECT * FROM customers WHERE user_id = ? AND bot_id = ?').get(userId, botId);

const upsertCustomer = (userId, name, botId = 1) => {
  const existing = getCustomer(userId, botId);
  if (existing) return existing;
  db.prepare('INSERT INTO customers (user_id, bot_id, name, xp, level) VALUES (?, ?, ?, 0, 1)').run(userId, botId, name);
  return getCustomer(userId, botId);
};

const addXp = (userId, xp, botId = 1) => {
  const customer = getCustomer(userId, botId);
  const newXp = (customer?.xp || 0) + xp;
  const newLevel = Math.min(10, Math.floor(newXp / 100) + 1);
  db.prepare('UPDATE customers SET xp = ?, level = ? WHERE user_id = ? AND bot_id = ?').run(newXp, newLevel, userId, botId);
  return getCustomer(userId, botId);
};

module.exports = { getCustomer, upsertCustomer, addXp };
