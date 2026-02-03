const { SlashCommandBuilder } = require('discord.js');
const { getOrCreateCart } = require('../database/models/cart');
const { buildCartView } = require('../utils/cartView');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('carrinho')
    .setDescription('Abra seu carrinho premium'),
  async execute(interaction) {
    const cart = getOrCreateCart(interaction.user.id);
    const view = buildCartView(cart.id);
    await interaction.reply({ embeds: [view.embed], components: view.components, ephemeral: true });
  }
};
