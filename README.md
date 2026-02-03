# VIA BOT – Vendedor Inteligente Autônomo

Bot de vendas premium para Discord com catálogo, carrinho, PIX, IA e painel web administrativo.

## Pré-requisitos
- Node.js 18+
- Token de bot do Discord

## Configuração
Crie um `.env` com:

```
DISCORD_TOKEN=seu_token
DISCORD_CLIENT_ID=seu_client_id
DISCORD_GUILD_ID=opcional_para_comandos_guild
DB_PATH=./data/via-bot.sqlite
WEB_PORT=3000
WEB_BASE_URL=http://localhost:3000
PAYMENT_PROVIDER=mercadopago # mercadopago | asaas | mock
MERCADOPAGO_TOKEN=seu_token_mp
ASAAS_TOKEN=seu_token_asaas
WEBHOOK_SECRET=seu_token_webhook
PAYER_EMAIL=cliente@viabot.dev
PIX_KEY=sua-chave-pix
PIX_NAME=VIA BOT STORE
PIX_CITY=SAO PAULO
OPENAI_API_KEY=sua-chave-openai
OPENAI_MODEL=gpt-4o-mini
```

## Rodando
```bash
npm install
npm run deploy
npm start
```

O painel web fica em `http://localhost:3000`.

## Observação sobre o banco
O projeto usa SQLite via `sql.js` (WebAssembly), evitando dependências nativas e facilitando a instalação em Windows e Linux.

## Webhook PIX
Configure o webhook no MercadoPago/Asaas apontando para:

```
POST http://SEU_DOMINIO/webhookpix
```

Quando o pagamento for confirmado, o bot atualiza o pedido para **APROVADO** e envia a mensagem no ticket.
