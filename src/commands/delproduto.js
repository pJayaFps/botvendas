const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { deleteProduct } = require('../database/models/products');
const { getBotContext } = require('../database/models/bots');
const { buildPremiumEmbed } = require('../utils/embeds');
const { isAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delproduto')
    .setDescription('Remover produto do catálogo (admin)')
    .addIntegerOption((option) => option.setName('id').setDescription('ID do produto').setRequired(true)),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'Apenas administradores podem usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const id = interaction.options.getInteger('id');
    const bot = getBotContext();
    const result = deleteProduct(id, bot.id);
    if (!result?.changes) {
      return interaction.reply({ content: 'Produto não encontrado para este bot.', flags: MessageFlags.Ephemeral });
    }
    const embed = buildPremiumEmbed({
      title: 'Produto Removido',
      description: `Produto #${id} foi removido do catálogo.`
    });
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
