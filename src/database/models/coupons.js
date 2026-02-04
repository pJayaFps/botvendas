const { db } = require('../index');

const createCoupon = (data) => {
  const stmt = db.prepare('INSERT INTO coupons (bot_id, code, type, value, min_level, active) VALUES (@bot_id, @code, @type, @value, @min_level, 1)');
  const result = stmt.run(data);
  if (result.lastInsertRowid) return result.lastInsertRowid;
  const fallback = db.prepare('SELECT id FROM coupons ORDER BY id DESC LIMIT 1').get();
  return fallback?.id;
};

const listCoupons = (botId) => db.prepare('SELECT * FROM coupons WHERE active = 1 AND bot_id = ? ORDER BY id DESC').all(botId);

const getCouponByCode = (code) => db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(code);

module.exports = { createCoupon, listCoupons, getCouponByCode };
