const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const { buildPremiumEmbed } = require('../utils/embeds');
const { saveReceipt } = require('../utils/receiptStore');
const { getTicketByChannel, setTicketAssignee, getTicketSettings } = require('../database/models/tickets');
const { getBotContext } = require('../database/models/bots');

const extractOrderId = (topic) => {
  const match = topic?.match(/Pedido\s+#(\d+)/i);
  return match ? match[1] : null;
};

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;

    const ticket = getTicketByChannel(message.channel.id);
    if (ticket && ticket.status === 'open' && !ticket.assumed_by) {
      const bot = getBotContext();
      const settings = getTicketSettings(bot.id, message.guild.id);
      const isStaff = settings?.staff_role_id && message.member?.roles?.cache?.has(settings.staff_role_id);
      if (isStaff) {
        setTicketAssignee(message.channel.id, message.author.id);
        await message.channel.send({ content: `Este ticket foi assumido por ${message.author}.` });
      }
    }

    if (!message.channel?.topic?.includes('Checkout VIA BOT')) return;
    if (!message.attachments?.size) return;

    const orderId = extractOrderId(message.channel.topic);
    if (!orderId) return;

    const adminId = config.discord.adminId || message.guild.ownerId;
    if (!adminId) return;

    saveReceipt(orderId, {
      channelId: message.channel.id,
      userId: message.author.id,
      receiptMessageId: message.id
    });

    const embed = buildPremiumEmbed({
      title: 'Novo Comprovante Recebido',
      description: `Pedido #${orderId} • Enviado por ${message.author.tag}`
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`receipt-approve-${orderId}`)
        .setLabel('Aprovar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`receipt-reject-${orderId}`)
        .setLabel('Reprovar')
        .setStyle(ButtonStyle.Danger)
    );

    try {
      const admin = await message.client.users.fetch(adminId);
      await admin.send({ embeds: [embed], components: [row], files: [...message.attachments.values()] });
    } catch (error) {
      console.error('[COMPROVANTE] Não foi possível enviar DM ao admin', error);
      await message.channel.send({
        content: `<@${adminId}> não consegui enviar DM. Use os botões abaixo para aprovar/reprovar.`,
        embeds: [embed],
        components: [row]
      });
    }
  }
};
