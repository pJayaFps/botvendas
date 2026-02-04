const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const config = require('../config');

const dbPath = path.resolve(config.database.path);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

let sqlModule;
let database;
let initialized = false;

const persist = () => {
  if (!database) return;
  const data = database.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
};

const normalizeParams = (params) => {
  if (params.length === 1 && params[0] && typeof params[0] === 'object' && !Array.isArray(params[0])) {
    const input = params[0];
    const normalized = {};
    Object.entries(input).forEach(([key, value]) => {
      const safeValue = value === undefined ? null : value;
      normalized[key] = safeValue;
      normalized[`@${key}`] = safeValue;
      normalized[`:${key}`] = safeValue;
      normalized[`$${key}`] = safeValue;
    });
    return normalized;
  }
  return params;
};

const getLastInsertId = () => {
  const stmt = database.prepare('SELECT last_insert_rowid() as id');
  const row = stmt.step() ? stmt.getAsObject() : { id: 0 };
  stmt.free();
  return row.id;
};

const prepare = (statement) => {
  return {
    run: (...params) => {
      const stmt = database.prepare(statement);
      stmt.bind(normalizeParams(params));
      while (stmt.step()) {
        // drain
      }
      stmt.free();
      const changes = database.getRowsModified();
      persist();
      return { changes, lastInsertRowid: getLastInsertId() };
    },
    get: (...params) => {
      const stmt = database.prepare(statement);
      stmt.bind(normalizeParams(params));
      const row = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return row;
    },
    all: (...params) => {
      const stmt = database.prepare(statement);
      stmt.bind(normalizeParams(params));
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    }
  };
};

const exec = (statement) => {
  database.exec(statement);
  persist();
};

const addColumnIfMissing = (table, column, definition) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((col) => col.name === column);
  if (!exists) {
    exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

const init = async () => {
  if (initialized) return;
  sqlModule = await initSqlJs({ locateFile: (file) => path.join(__dirname, '../../node_modules/sql.js/dist', file) });
  const exists = fs.existsSync(dbPath);
  const fileBuffer = exists ? fs.readFileSync(dbPath) : undefined;
  database = new sqlModule.Database(fileBuffer);
  exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      image_url TEXT,
      category TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY(cart_id) REFERENCES carts(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER DEFAULT 1,
      user_id TEXT NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id)
    );
    CREATE TABLE IF NOT EXISTS customers (
      user_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      favorites TEXT NOT NULL DEFAULT '[]',
      coupons_used TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER DEFAULT 1,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      min_level INTEGER DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id TEXT NOT NULL,
      bot_name TEXT NOT NULL,
      bot_token TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'offline',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id INTEGER NOT NULL,
      user_discord TEXT NOT NULL,
      valor REAL NOT NULL,
      produto TEXT NOT NULL,
      quantidade INTEGER NOT NULL,
      status TEXT NOT NULL,
      data TEXT NOT NULL
    );
  `);
  addColumnIfMissing('products', 'bot_id', 'INTEGER DEFAULT 1');
  addColumnIfMissing('orders', 'bot_id', 'INTEGER DEFAULT 1');
  addColumnIfMissing('coupons', 'bot_id', 'INTEGER DEFAULT 1');
  const token = config.discord.token || 'default-token';
  const existingBot = db.prepare('SELECT id FROM bots WHERE bot_token = ?').get(token);
  let defaultBotId = existingBot?.id;
  if (!defaultBotId) {
    db.prepare(
      'INSERT INTO bots (owner_id, bot_name, bot_token, status, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('system', 'VIA BOT', token, 'online', new Date().toISOString());
    defaultBotId = db.prepare('SELECT id FROM bots WHERE bot_token = ?').get(token)?.id;
  }
  const safeBotId = defaultBotId || 1;
  db.prepare('UPDATE products SET bot_id = ? WHERE bot_id IS NULL OR bot_id = 0').run(safeBotId);
  db.prepare('UPDATE orders SET bot_id = ? WHERE bot_id IS NULL OR bot_id = 0').run(safeBotId);
  db.prepare('UPDATE coupons SET bot_id = ? WHERE bot_id IS NULL OR bot_id = 0').run(safeBotId);
  initialized = true;
};

const db = {
  prepare,
  exec
};

module.exports = { db, init };
