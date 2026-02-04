const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildCatalogView } = require('../utils/catalog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('catalogo')
    .setDescription('Abra o catálogo premium (privado)')
    .setDMPermission(false),
  async execute(interaction) {
    const { getOrCreateDefaultBot } = require('../database/models/bots');
    const bot = getOrCreateDefaultBot();
    const view = buildCatalogView({ botId: bot.id });
    await interaction.reply({ embeds: [view.embed], components: view.components, flags: MessageFlags.Ephemeral });
  }
};
