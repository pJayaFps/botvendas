const { db } = require('../index');

const countUsers = () => db.prepare('SELECT COUNT(*) as total FROM users').get()?.total || 0;

const getUserByEmail = (email) => db.prepare('SELECT * FROM users WHERE email = ?').get(email);

const getUserById = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

const createUser = (data) => {
  const stmt = db.prepare(`
    INSERT INTO users (username, email, password_hash, role, created_at)
    VALUES (@username, @email, @password_hash, @role, @created_at)
  `);
  const result = stmt.run(data);
  if (result.lastInsertRowid) return result.lastInsertRowid;
  const fallback = db.prepare('SELECT id FROM users ORDER BY id DESC LIMIT 1').get();
  return fallback?.id;
};

module.exports = { countUsers, getUserByEmail, getUserById, createUser };
