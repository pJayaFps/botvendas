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
DISCORD_ADMIN_ID=seu_user_id_admin
DB_PATH=./data/via-bot.sqlite
WEB_PORT=3000
WEB_BASE_URL=http://localhost:3000
WEB_JWT_SECRET=sua_chave_jwt
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
O fluxo atual usa aprovação manual via botões no ticket. Quando desejar integração automática, podemos reativar o webhook.
