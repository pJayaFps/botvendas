# Bot de Farming (Discord) — 100% Painel e Botões

Este projeto implementa um bot de farming com metas por cargo **sem slash commands para operação**: o uso é feito via painel com botões e modais.

## Fluxo do painel

Ao clicar nos botões do painel:

- **Configurar Farming** (somente admin)
  - escolhe o cargo
  - preenche item, meta e período (semanal/mensal)
- **Ver Metas**
  - lista metas por cargo/item
- **Abrir Softfarm**
  - usuário informa item, quantidade e observação
  - bot registra progresso no ciclo
  - bloqueia novo farm quando meta do ciclo já foi batida
- **Minha Meta**
  - mostra progresso por item/cargo do usuário
- **Ranking**
  - consulta ranking do item (top 10 no ciclo atual)

## Persistência

SQLite (`farming.db`) com:

- `metas` (metas por cargo)
- `progress` (progresso por usuário/meta)
- `farm_logs` (histórico de farms)
- `panel_state` (estado do painel)

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# preencha DISCORD_TOKEN e PANEL_CHANNEL_ID
python bot.py
```

## Variáveis de ambiente

- `DISCORD_TOKEN` (obrigatória)
- `PANEL_CHANNEL_ID` (obrigatória para envio automático do painel)

## Observações

- Coloque o cargo do bot acima dos cargos dos membros para evitar problemas de permissão.
- O ciclo é resetado automaticamente (semanal/mensal), mantendo o total acumulado.
