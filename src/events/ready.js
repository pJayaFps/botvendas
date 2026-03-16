const { syncDeliveryChannels } = require('../utils/deliveryTracker');
const { buildPremiumEmbed } = require('../utils/embeds');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    const embed = buildPremiumEmbed({
      title: 'VIA BOT Online',
      description: `Conectado como ${client.user.tag}.`
    });
    console.log(`[VIA BOT] Online: ${client.user.tag}`);
    if (client.logChannel) {
      client.logChannel.send({ embeds: [embed] }).catch(() => null);
    }

    await syncDeliveryChannels(client).catch(() => null);
    setInterval(() => {
      syncDeliveryChannels(client).catch(() => null);
    }, 60 * 60 * 1000);
  }
};
