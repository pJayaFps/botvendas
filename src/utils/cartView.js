const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getCartById, listCartItems } = require('../database/models/cart');
const { getCouponByCode } = require('../database/models/coupons');
const { applyCouponDiscount } = require('./coupons');
const { buildPremiumEmbed } = require('./embeds');
const { calculateTotal, formatCurrency } = require('./format');

const buildCartView = (cartId) => {
  const cart = getCartById(cartId);
  const items = listCartItems(cartId);
  const fields = items.map((item) => ({
    name: `${item.name} • ${formatCurrency(item.price)}`,
    value: `Qtd: ${item.quantity} | Subtotal: ${formatCurrency(item.price * item.quantity)}`,
    inline: false
  }));

  const total = calculateTotal(items);
  const coupon = cart?.coupon_code ? getCouponByCode(cart.coupon_code) : null;
  const discountData = applyCouponDiscount(total, coupon);

  const embed = buildPremiumEmbed({
    title: 'Carrinho Premium',
    description: items.length ? 'Gerencie seu carrinho em tempo real.' : 'Seu carrinho está vazio. Explore o catálogo! ',
    fields: fields.length ? fields : [{ name: 'Sem itens', value: 'Use /painel para adicionar produtos.' }],
    image: items[0]?.image_url || undefined
  });

  embed.addFields({ name: 'Total', value: formatCurrency(discountData.total) });
  if (coupon) {
    const discountLabel = discountData.discount ? `Desconto: ${formatCurrency(discountData.discount)}` : 'Sem desconto aplicado';
    embed.addFields({
      name: 'Cupom aplicado',
      value: `${coupon.code} (${coupon.type}) • ${discountLabel}`,
      inline: false
    });
  }
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
      new ButtonBuilder()
        .setCustomId(coupon ? 'cart-coupon-clear' : 'cart-coupon')
        .setLabel(coupon ? 'Remover cupom' : 'Aplicar cupom')
        .setStyle(coupon ? ButtonStyle.Secondary : ButtonStyle.Primary),
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
