const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { listCartItems } = require('../database/models/cart');
const { buildPremiumEmbed } = require('./embeds');
const { calculateTotal, formatCurrency } = require('./format');

const buildCartView = (cartId) => {
  const items = listCartItems(cartId);
  const fields = items.map((item) => ({
    name: `${item.name} • ${formatCurrency(item.price)}`,
    value: `Qtd: ${item.quantity} | Subtotal: ${formatCurrency(item.price * item.quantity)}`,
    inline: false
  }));

  const total = calculateTotal(items);

  const embed = buildPremiumEmbed({
    title: 'Carrinho Premium',
    description: items.length ? 'Gerencie seu carrinho em tempo real.' : 'Seu carrinho está vazio. Explore o catálogo! ',
    fields: fields.length ? fields : [{ name: 'Sem itens', value: 'Use /painel para adicionar produtos.' }],
    image: items[0]?.image_url || undefined
  });

  embed.addFields({ name: 'Total', value: formatCurrency(total) });
  if (items.length > 4) {
    embed.addFields({
      name: 'Gerenciamento',
      value: 'Use os botões para ajustar ou remover os 4 primeiros itens listados.',
      inline: false
    });
  }

  const rows = [];
  if (items.length) {
    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cart-clear').setLabel('Limpar').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cart-checkout').setLabel('Finalizar').setStyle(ButtonStyle.Success)
    );

    const manageableItems = items.slice(0, 4);
    manageableItems.forEach((item) => {
      const manageRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`cart-decrease-${item.cart_item_id}`).setLabel('➖').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`cart-increase-${item.cart_item_id}`).setLabel('➕').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`cart-remove-${item.cart_item_id}`).setLabel('Remover').setStyle(ButtonStyle.Secondary)
      );
      rows.push(manageRow);
    });

    rows.push(controlRow);
  }

  return { embed, components: rows, total, items };
};

module.exports = { buildCartView };
