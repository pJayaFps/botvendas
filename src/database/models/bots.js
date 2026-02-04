const { db } = require('../index');
const config = require('../config');

const getBotById = (id) => db.prepare('SELECT * FROM bots WHERE id = ?').get(id);

const getBotByToken = (token) => db.prepare('SELECT * FROM bots WHERE bot_token = ?').get(token);

const listBotsByOwner = (ownerId) => db.prepare('SELECT * FROM bots WHERE owner_id = ? ORDER BY id DESC').all(ownerId);

const createBot = (data) => {
  const stmt = db.prepare(`
    INSERT INTO bots (owner_id, bot_name, bot_token, status, created_at)
    VALUES (@owner_id, @bot_name, @bot_token, @status, @created_at)
  `);
  const result = stmt.run(data);
  if (result.lastInsertRowid) return result.lastInsertRowid;
  const fallback = db.prepare('SELECT id FROM bots ORDER BY id DESC LIMIT 1').get();
  return fallback?.id;
};

const getOrCreateDefaultBot = () => {
  const token = config.discord.token || 'default-token';
  const existing = getBotByToken(token);
  if (existing) return existing;
  const createdAt = new Date().toISOString();
  const id = createBot({
    owner_id: 'system',
    bot_name: 'VIA BOT',
    bot_token: token,
    status: 'online',
    created_at: createdAt
  });
  return getBotById(id);
};

module.exports = { getBotById, listBotsByOwner, createBot, getOrCreateDefaultBot };
