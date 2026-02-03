const { db } = require('../index');

const listProducts = (category) => {
  if (category) {
    return db.prepare('SELECT * FROM products WHERE active = 1 AND category = ? ORDER BY id DESC').all(category);
  }
  return db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY id DESC').all();
};

const getProduct = (id) => db.prepare('SELECT * FROM products WHERE id = ?').get(id);

const createProduct = (data) => {
  const stmt = db.prepare(`
    INSERT INTO products (name, description, price, image_url, category, stock, active)
    VALUES (@name, @description, @price, @image_url, @category, @stock, 1)
  `);
  return stmt.run(data).lastInsertRowid;
};

const updateProduct = (id, data) => {
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
  return stmt.run({ ...data, id });
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
