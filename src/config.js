require('dotenv').config();

module.exports = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID
  },
  database: {
    path: process.env.DB_PATH || './data/via-bot.sqlite'
  },
  web: {
    port: Number(process.env.WEB_PORT || 3000),
    baseUrl: process.env.WEB_BASE_URL || 'http://localhost:3000'
  },
  payments: {
    provider: process.env.PAYMENT_PROVIDER || 'mock',
    mercadoPagoToken: process.env.MERCADOPAGO_TOKEN || '',
    asaasToken: process.env.ASAAS_TOKEN || '',
    webhookSecret: process.env.WEBHOOK_SECRET || '',
    payerEmail: process.env.PAYER_EMAIL || 'cliente@viabot.dev',
    pixKey: process.env.PIX_KEY || 'SUA-CHAVE-PIX-AQUI',
    pixName: process.env.PIX_NAME || 'VIA BOT STORE',
    pixCity: process.env.PIX_CITY || 'SAO PAULO'
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'openai',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  }
};
