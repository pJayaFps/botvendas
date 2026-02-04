const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { listOrders } = require('../database/models/orders');
const { getBotContext } = require('../database/models/bots');
const { buildPremiumEmbed } = require('../utils/embeds');
const { formatCurrency } = require('../utils/format');
const { isAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vervendas')
    .setDescription('Ver resumo de vendas (admin)'),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'Apenas administradores podem usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const bot = getBotContext();
    const orders = listOrders(bot.id, 'APROVADO').slice(0, 5);
    const fields = orders.map((order) => ({
      name: `Pedido #${order.id} • ${order.status}`,
      value: `Cliente: ${order.user_id} | Total: ${formatCurrency(order.total)}`,
      inline: false
    }));

    const embed = buildPremiumEmbed({
      title: 'Resumo de Vendas',
      description: 'Últimos pedidos registrados.',
      fields: fields.length ? fields : [{ name: 'Sem vendas', value: 'Nenhum pedido registrado.' }]
    });

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
