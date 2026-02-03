const express = require('express');
const path = require('path');
const config = require('../config');
const { db, init } = require('../database');
const { parseWebhookPayload } = require('../utils/payments');
const { getPaymentByPaymentId, updatePaymentStatus } = require('../database/models/payments');
const { updateOrderStatus } = require('../database/models/orders');
const { buildPremiumEmbed } = require('../utils/embeds');

const app = express();
let discordClient;

app.use(express.json({ limit: '2mb' }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  const totals = db.prepare("SELECT COUNT(*) as totalOrders, IFNULL(SUM(total), 0) as totalRevenue FROM orders WHERE status = 'APROVADO'").get();
  const products = db.prepare('SELECT * FROM products ORDER BY id DESC LIMIT 5').all();
  const customers = db.prepare('SELECT * FROM customers ORDER BY xp DESC LIMIT 5').all();
  res.render('dashboard', { totals, products, customers });
});

app.get('/produtos', (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  res.render('products', { products });
});

app.get('/pedidos', (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE status = 'APROVADO' ORDER BY id DESC").all();
  res.render('orders', { orders });
});

app.get('/clientes', (req, res) => {
  const customers = db.prepare('SELECT * FROM customers ORDER BY xp DESC').all();
  res.render('customers', { customers });
});

app.post('/webhookpix', async (req, res) => {
  const payload = parseWebhookPayload(req.body);
  if (!payload?.paymentId) {
    return res.status(400).json({ error: 'payment_id not found' });
  }

  const payment = getPaymentByPaymentId(payload.paymentId);
  if (!payment) {
    return res.status(404).json({ error: 'payment not found' });
  }

  updatePaymentStatus(payload.paymentId, 'PAGO');
  updateOrderStatus(payment.order_id, 'APROVADO');

  if (discordClient) {
    try {
      const channel = await discordClient.channels.fetch(payment.ticket_channel_id);
      const embed = buildPremiumEmbed({
        title: 'Pagamento Confirmado',
        description: '✅ Pagamento confirmado! Obrigado pela sua compra.'
      });
      await channel.send({ content: `<@${payment.user_id}>`, embeds: [embed] });
      setTimeout(async () => {
        await channel.delete('Checkout finalizado');
      }, 5000);
    } catch (error) {
      console.error('[WEBHOOK] Não foi possível enviar mensagem no Discord', error);
    }
  }

  return res.json({ ok: true });
});

const start = async (client) => {
  discordClient = client;
  await init();
  app.listen(config.web.port, () => {
    console.log(`[WEB] Painel rodando em ${config.web.baseUrl}`);
  });
  return app;
};

module.exports = start;
