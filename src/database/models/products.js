const { db } = require('../index');

const listProducts = (botId = 1, category) => {
  if (category) {
    return db
      .prepare('SELECT *, TRIM(category) AS category FROM products WHERE active = 1 AND bot_id = ? AND TRIM(category) = ? ORDER BY id DESC')
      .all(botId, category.trim());
  }
  return db
    .prepare('SELECT *, TRIM(category) AS category FROM products WHERE active = 1 AND bot_id = ? ORDER BY id DESC')
    .all(botId);
};

const getProduct = (id) => db.prepare('SELECT * FROM products WHERE id = ?').get(id);

const createProduct = (data) => {
  const category = data.category?.trim();
  const stmt = db.prepare(`
    INSERT INTO products (bot_id, name, description, price, image_url, category, stock, active)
    VALUES (@bot_id, @name, @description, @price, @image_url, @category, @stock, 1)
  `);
  const result = stmt.run({ ...data, category });
  if (result.lastInsertRowid) return result.lastInsertRowid;
  const fallback = db.prepare('SELECT id FROM products ORDER BY id DESC LIMIT 1').get();
  return fallback?.id;
};

const updateProduct = (id, data) => {
  const category = data.category?.trim();
  const stmt = db.prepare(`
    UPDATE products
    SET name = @name,
        description = @description,
        price = @price,
        image_url = @image_url,
        category = @category,
        stock = @stock,
        active = @active
    WHERE id = @id
  `);
  return stmt.run({ ...data, category, id });
};

const deleteProduct = (id) => {
  return db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id);
};

const decrementStock = (id, quantity) => {
  return db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?').run(quantity, id, quantity);
};

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  decrementStock
};
