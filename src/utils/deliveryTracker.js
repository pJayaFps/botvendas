const { listOpenDeliveries, markDeliveryDone } = require('../database/models/deliveries');

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeName = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'cliente';

const buildProgressName = (usernameSlug, remainingDays) => {
  if (remainingDays <= 0) {
    return `entregar-${normalizeName(usernameSlug)}`.slice(0, 100);
  }
  return `${remainingDays}d-${normalizeName(usernameSlug)}`.slice(0, 100);
};

const syncDeliveryChannels = async (client) => {
  const deliveries = listOpenDeliveries();
  const now = Date.now();

  for (const delivery of deliveries) {
    const approvedAt = new Date(delivery.approved_at).getTime();
    if (Number.isNaN(approvedAt)) continue;

    const elapsedDays = Math.floor((now - approvedAt) / DAY_MS);
    const remainingDays = Math.max(3 - elapsedDays, 0);
    const expectedName = buildProgressName(delivery.username_slug, remainingDays);

    const channel = await client.channels.fetch(delivery.channel_id).catch(() => null);
    if (!channel) {
      markDeliveryDone(delivery.order_id);
      continue;
    }

    if (channel.name !== expectedName) {
      await channel.setName(expectedName).catch(() => null);
    }

    if (remainingDays <= 0) {
      markDeliveryDone(delivery.order_id);
      await channel.send({ content: '⏰ Prazo finalizado. Status do canal atualizado para entrega.' }).catch(() => null);
    }
  }
};

module.exports = { syncDeliveryChannels, buildProgressName };
