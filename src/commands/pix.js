const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getBotContext } = require('../database/models/bots');
const { getTicketSettings, getTicketByChannel } = require('../database/models/tickets');
const { buildPremiumEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('pix').setDescription('Enviar dados PIX dentro do ticket'),
  async execute(interaction) {
    const ticket = getTicketByChannel(interaction.channelId);
    if (!ticket) {
      return interaction.reply({ content: 'Use este comando apenas dentro de um ticket.', flags: MessageFlags.Ephemeral });
    }

    const bot = getBotContext();
    const settings = getTicketSettings(bot.id, interaction.guildId);
    if (!settings?.pix_key) {
      return interaction.reply({ content: 'PIX não configurado no painel web.', flags: MessageFlags.Ephemeral });
    }

    const embed = buildPremiumEmbed({
      title: 'Pagamento PIX (Ticket)',
      description: settings.pix_embed_message || 'Realize o pagamento e aguarde confirmação manual da staff.',
      fields: [
        { name: 'Recebedor', value: settings.pix_receiver || 'Não definido', inline: false },
        { name: 'Chave PIX', value: `\`${settings.pix_key}\``, inline: false }
      ],
      image: settings.pix_qr_url || undefined
    });

    return interaction.reply({ embeds: [embed] });
  }
};
