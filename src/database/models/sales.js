const { db } = require('../index');

const createSale = (data) => {
  const stmt = db.prepare(`
    INSERT INTO sales (bot_id, user_discord, valor, produto, quantidade, status, data)
    VALUES (@bot_id, @user_discord, @valor, @produto, @quantidade, @status, @data)
  `);
  const result = stmt.run(data);
  if (result.lastInsertRowid) return result.lastInsertRowid;
  const fallback = db.prepare('SELECT id FROM sales ORDER BY id DESC LIMIT 1').get();
  return fallback?.id;
};

const listSalesByBot = (botId) => db.prepare('SELECT * FROM sales WHERE bot_id = ? ORDER BY id DESC').all(botId);

const listSalesByBotStatus = (botId, status) => db.prepare('SELECT * FROM sales WHERE bot_id = ? AND status = ? ORDER BY id DESC').all(botId, status);

const updateSaleStatusByOrder = (botId, userDiscord, status) => {
  return db.prepare('UPDATE sales SET status = ? WHERE bot_id = ? AND user_discord = ? AND status = ?').run(status, botId, userDiscord, 'pendente');
};

module.exports = { createSale, listSalesByBot, listSalesByBotStatus, updateSaleStatusByOrder };
