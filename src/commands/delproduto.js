const { SlashCommandBuilder } = require('discord.js');
const { deleteProduct } = require('../database/models/products');
const { buildPremiumEmbed } = require('../utils/embeds');
const { isAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delproduto')
    .setDescription('Remover produto do catálogo (admin)')
    .addIntegerOption((option) => option.setName('id').setDescription('ID do produto').setRequired(true)),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'Apenas administradores podem usar este comando.', ephemeral: true });
    }

    const id = interaction.options.getInteger('id');
    deleteProduct(id);
    const embed = buildPremiumEmbed({
      title: 'Produto Removido',
      description: `Produto #${id} foi removido do catálogo.`
    });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
