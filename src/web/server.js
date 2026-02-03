const express = require('express');
const path = require('path');
const config = require('../config');
const { db, init } = require('../database');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  const totals = db.prepare('SELECT COUNT(*) as totalOrders, IFNULL(SUM(total), 0) as totalRevenue FROM orders').get();
  const products = db.prepare('SELECT * FROM products ORDER BY id DESC LIMIT 5').all();
  const customers = db.prepare('SELECT * FROM customers ORDER BY xp DESC LIMIT 5').all();
  res.render('dashboard', { totals, products, customers });
});

app.get('/produtos', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  res.render('products', { products });
});

app.get('/pedidos', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  res.render('orders', { orders });
});

app.get('/clientes', (req, res) => {
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
