const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildCatalogView } = require('../utils/catalog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('catalogo')
    .setDescription('Abra o catálogo premium (privado)')
    .setDMPermission(false),
  async execute(interaction) {
    const { getBotContext } = require('../database/models/bots');
    const bot = getBotContext();
    const view = buildCatalogView({ botId: bot.id });
    await interaction.reply({ embeds: [view.embed], components: view.components, flags: MessageFlags.Ephemeral });
  }
};
