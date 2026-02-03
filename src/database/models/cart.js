const { db } = require('../index');

const getOrCreateCart = (userId) => {
  const existing = db.prepare('SELECT * FROM carts WHERE user_id = ? AND status = ? ORDER BY id DESC').get(userId, 'open');
  if (existing) return existing;
  const createdAt = new Date().toISOString();
  const result = db.prepare('INSERT INTO carts (user_id, status, created_at) VALUES (?, ?, ?)').run(userId, 'open', createdAt);
  return db.prepare('SELECT * FROM carts WHERE id = ?').get(result.lastInsertRowid);
};

const listCartItems = (cartId) => {
  return db.prepare(`
    SELECT cart_items.id AS cart_item_id, cart_items.quantity, products.id AS product_id, products.name, products.description, products.price, products.image_url
    FROM cart_items
    JOIN products ON products.id = cart_items.product_id
    WHERE cart_items.cart_id = ?
  `).all(cartId);
};

const addItem = (cartId, productId, quantity = 1) => {
  const existing = db.prepare('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?').get(cartId, productId);
  if (existing) {
    return db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
  }
  return db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)').run(cartId, productId, quantity);
};

const updateItemQuantity = (itemId, quantity) => {
  if (quantity <= 0) {
    return db.prepare('DELETE FROM cart_items WHERE id = ?').run(itemId);
  }
  return db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, itemId);
};

const clearCart = (cartId) => db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);

const closeCart = (cartId) => db.prepare('UPDATE carts SET status = ? WHERE id = ?').run('closed', cartId);

module.exports = {
  getOrCreateCart,
  listCartItems,
  addItem,
  updateItemQuantity,
  clearCart,
  closeCart
};
