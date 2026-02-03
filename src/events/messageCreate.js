const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');
const { buildPremiumEmbed } = require('../utils/embeds');
const { saveReceipt } = require('../utils/receiptStore');

const extractOrderId = (topic) => {
  const match = topic?.match(/Pedido\s+#(\d+)/i);
  return match ? match[1] : null;
};

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.channel?.topic?.includes('Checkout VIA BOT')) return;
    if (!message.attachments?.size) return;

    const orderId = extractOrderId(message.channel.topic);
    if (!orderId) return;

    const adminId = config.discord.adminId;
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
    }
  }
};
