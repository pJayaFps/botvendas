const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { buildCatalogView } = require('../utils/catalog');
const { buildPremiumEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abra o painel premium de produtos'),
  async execute(interaction) {
    const embed = buildPremiumEmbed({
      title: 'Painel de Vendas VIA BOT',
      description: [
        'Bem-vindo ao painel oficial de vendas!',
        '🔹 Clique no botão abaixo para ver as opções e produtos disponíveis.',
        '🔹 Atendimento automático e checkout instantâneo.'
      ].join('\n'),
      fields: [
        { name: '✨ Produtos Premium', value: 'Seleção exclusiva com estoque limitado.' },
        { name: '⚡ Entrega Ágil', value: 'Processamento rápido e suporte inteligente.' }
      ]
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel-open-catalog')
        .setLabel('Ver Produtos')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('panel-open-offers')
        .setLabel('Ver Ofertas')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
