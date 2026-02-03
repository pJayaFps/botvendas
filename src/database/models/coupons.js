const { db } = require('../index');

const createCoupon = (data) => {
  const stmt = db.prepare('INSERT INTO coupons (code, type, value, min_level, active) VALUES (@code, @type, @value, @min_level, 1)');
  const result = stmt.run(data);
  if (result.lastInsertRowid) return result.lastInsertRowid;
  const fallback = db.prepare('SELECT id FROM coupons ORDER BY id DESC LIMIT 1').get();
  return fallback?.id;
};

const listCoupons = () => db.prepare('SELECT * FROM coupons WHERE active = 1 ORDER BY id DESC').all();

const getCouponByCode = (code) => db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(code);

module.exports = { createCoupon, listCoupons, getCouponByCode };
