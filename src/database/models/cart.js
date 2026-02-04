const { db } = require('../index');

const getOrCreateCart = (userId, botId = 1) => {
  const existing = db
    .prepare('SELECT * FROM carts WHERE user_id = ? AND bot_id = ? AND status = ? ORDER BY id DESC')
    .get(userId, botId, 'open');
  if (existing) return existing;
  const createdAt = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO carts (bot_id, user_id, status, created_at) VALUES (?, ?, ?, ?)')
    .run(botId, userId, 'open', createdAt);
  if (result.lastInsertRowid) {
    return db.prepare('SELECT * FROM carts WHERE id = ?').get(result.lastInsertRowid);
  }
  return db
    .prepare('SELECT * FROM carts WHERE user_id = ? AND bot_id = ? AND status = ? ORDER BY id DESC')
    .get(userId, botId, 'open');
};

const getCartById = (cartId) => db.prepare('SELECT * FROM carts WHERE id = ?').get(cartId);

const listCartItems = (cartId) => {
  return db.prepare(`
    SELECT cart_items.id AS cart_item_id, cart_items.quantity, products.id AS product_id, products.name, products.description, products.price, products.image_url
    FROM cart_items
    JOIN products ON products.id = cart_items.product_id
    WHERE cart_items.cart_id = ?
  `).all(cartId);
};

const addItem = (cartId, productId, quantity = 1, botId = 1) => {
  const existing = db.prepare('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?').get(cartId, productId);
  if (existing) {
    return db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
  }
  return db
    .prepare('INSERT INTO cart_items (bot_id, cart_id, product_id, quantity) VALUES (?, ?, ?, ?)')
    .run(botId, cartId, productId, quantity);
};

const updateItemQuantity = (itemId, quantity) => {
  if (quantity <= 0) {
    return db.prepare('DELETE FROM cart_items WHERE id = ?').run(itemId);
  }
  return db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, itemId);
};

const clearCart = (cartId) => db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);

const closeCart = (cartId) => db.prepare('UPDATE carts SET status = ? WHERE id = ?').run('closed', cartId);

const setCartCoupon = (cartId, code) => db.prepare('UPDATE carts SET coupon_code = ? WHERE id = ?').run(code, cartId);

const clearCartCoupon = (cartId) => db.prepare('UPDATE carts SET coupon_code = NULL WHERE id = ?').run(cartId);

module.exports = {
  getOrCreateCart,
  getCartById,
  listCartItems,
  addItem,
  updateItemQuantity,
  clearCart,
  closeCart,
  setCartCoupon,
  clearCartCoupon
};
