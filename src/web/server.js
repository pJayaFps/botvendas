const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { db, init } = require('../database');
const { countUsers, getUserByEmail, createUser, getUserById } = require('../database/models/users');
const { listBotsByOwner, upsertBotByToken, getBotById } = require('../database/models/bots');
const { listSalesByBot, listSalesByBotStatus } = require('../database/models/sales');
const { listProducts } = require('../database/models/products');
const { listCoupons } = require('../database/models/coupons');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/public', express.static(path.join(__dirname, 'public')));

const authRequired = (req, res, next) => {
  const token = req.cookies?.auth;
  if (!token) return res.redirect('/login');
  try {
    const payload = jwt.verify(token, config.web.jwtSecret);
    req.user = payload;
    return next();
  } catch (error) {
    return res.redirect('/login');
  }
};

const roleRequired = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).send('Acesso negado.');
  }
  return next();
};

app.get('/', authRequired, (req, res) => res.redirect('/bots'));

app.get('/login', (req, res) => res.render('login'));

app.post('/login', async (req, res) => {
  const user = getUserByEmail(req.body.email);
  if (!user) return res.render('login', { error: 'Credenciais inválidas.' });
  const match = await bcrypt.compare(req.body.password, user.password_hash);
  if (!match) return res.render('login', { error: 'Credenciais inválidas.' });
  const token = jwt.sign({ userId: user.id, role: user.role }, config.web.jwtSecret, { expiresIn: '7d' });
  res.cookie('auth', token, { httpOnly: true });
  return res.redirect('/bots');
});

app.get('/register', (req, res) => res.render('register'));

app.post('/register', async (req, res) => {
  const exists = getUserByEmail(req.body.email);
  if (exists) return res.render('register', { error: 'E-mail já cadastrado.' });
  const hash = await bcrypt.hash(req.body.password, 10);
  const isFirst = countUsers() === 0;
  const userId = createUser({
    username: req.body.username,
    email: req.body.email,
    password_hash: hash,
    role: isFirst ? 'owner' : 'staff',
    created_at: new Date().toISOString()
  });
  const user = getUserById(userId);
  const token = jwt.sign({ userId: user.id, role: user.role }, config.web.jwtSecret, { expiresIn: '7d' });
  res.cookie('auth', token, { httpOnly: true });
  return res.redirect('/bots');
});

app.post('/logout', (req, res) => {
  res.clearCookie('auth');
  return res.redirect('/login');
});

app.get('/bots', authRequired, (req, res) => {
  const bots = listBotsByOwner(req.user.userId).map((bot) => ({
    ...bot,
    status: bot.bot_token === config.discord.token ? 'online' : bot.status
  }));
  res.render('bots', { bots });
});

app.post('/bots', authRequired, roleRequired(['owner', 'admin']), (req, res) => {
  upsertBotByToken({
    owner_id: String(req.user.userId),
    bot_name: req.body.bot_name,
    bot_token: req.body.bot_token,
    status: req.body.bot_token === config.discord.token ? 'online' : 'configurado',
    created_at: new Date().toISOString()
  });
  return res.redirect('/bots');
});

app.get('/dashboard/:botId', authRequired, (req, res) => {
  const bot = getBotById(req.params.botId);
  if (!bot || String(bot.owner_id) !== String(req.user.userId)) {
    return res.status(404).send('Bot não encontrado.');
  }
  const sales = listSalesByBot(bot.id);
  const pending = listSalesByBotStatus(bot.id, 'pendente');
  const revenue = sales.reduce((sum, sale) => sum + sale.valor, 0);
  const products = listProducts(bot.id).slice(0, 5);
  const coupons = listCoupons(bot.id).slice(0, 5);
  res.render('dashboard-bot', { bot, sales, pending, revenue, products, coupons });
});

app.get('/bots/:botId/products', authRequired, (req, res) => {
  const bot = getBotById(req.params.botId);
  if (!bot || String(bot.owner_id) !== String(req.user.userId)) {
    return res.status(404).send('Bot não encontrado.');
  }
  const products = listProducts(bot.id);
  res.render('products-bot', { bot, products });
});

app.post('/bots/:botId/products', authRequired, roleRequired(['owner', 'admin']), (req, res) => {
  const bot = getBotById(req.params.botId);
  if (!bot || String(bot.owner_id) !== String(req.user.userId)) {
    return res.status(404).send('Bot não encontrado.');
  }
  db.prepare(`
    INSERT INTO products (bot_id, name, description, price, image_url, category, stock, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    bot.id,
    req.body.name,
    req.body.description,
    Number(req.body.price),
    req.body.image_url,
    req.body.category,
    Number(req.body.stock || 0)
  );
  return res.redirect(`/bots/${bot.id}/products`);
});

app.post('/bots/:botId/products/:productId/delete', authRequired, roleRequired(['owner', 'admin']), (req, res) => {
  const bot = getBotById(req.params.botId);
  if (!bot || String(bot.owner_id) !== String(req.user.userId)) {
    return res.status(404).send('Bot não encontrado.');
  }
  db.prepare('UPDATE products SET active = 0 WHERE id = ? AND bot_id = ?').run(req.params.productId, bot.id);
  return res.redirect(`/bots/${bot.id}/products`);
});

app.get('/pedidos', authRequired, (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE status = 'APROVADO' ORDER BY id DESC").all();
  res.render('orders', { orders });
});

app.get('/clientes', authRequired, (req, res) => {
  const customers = db.prepare('SELECT * FROM customers ORDER BY xp DESC').all();
  res.render('customers', { customers });
});

const start = async () => {
  await init();
  app.listen(config.web.port, () => {
    console.log(`[WEB] Painel rodando em ${config.web.baseUrl}`);
  });
  return app;
};

module.exports = start;
