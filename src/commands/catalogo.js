const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildCatalogView } = require('../utils/catalog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abra o painel premium de produtos'),
  async execute(interaction) {
    const view = buildCatalogView({});
    await interaction.reply({ embeds: [view.embed], components: view.components });
  }
};
