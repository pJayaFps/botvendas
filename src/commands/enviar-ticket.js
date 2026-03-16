const { SlashCommandBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { isAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder().setName('enviar-ticket').setDescription('Enviar painel de tickets (admin)'),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'Apenas administradores podem usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const modal = new ModalBuilder().setCustomId('ticket-panel-modal').setTitle('Configurar painel de tickets');
    const fields = [
      new TextInputBuilder().setCustomId('title').setLabel('Título do embed').setStyle(TextInputStyle.Short).setRequired(true),
      new TextInputBuilder().setCustomId('description').setLabel('Descrição do embed').setStyle(TextInputStyle.Paragraph).setRequired(true),
      new TextInputBuilder().setCustomId('category').setLabel('ID da categoria dos tickets').setStyle(TextInputStyle.Short).setRequired(true),
      new TextInputBuilder().setCustomId('staff').setLabel('ID do cargo da staff').setStyle(TextInputStyle.Short).setRequired(true),
      new TextInputBuilder().setCustomId('openRole').setLabel('ID do cargo autorizado a abrir').setStyle(TextInputStyle.Short).setRequired(true)
    ];

    modal.addComponents(...fields.map((f) => new ActionRowBuilder().addComponents(f)));
    return interaction.showModal(modal);
  }
};
