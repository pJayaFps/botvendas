const { AttachmentBuilder } = require('discord.js');
const { getOrCreateCart, addItem, listCartItems, updateItemQuantity, clearCart, closeCart } = require('../database/models/cart');
const { getProduct, decrementStock } = require('../database/models/products');
const { createOrder, updateOrderStatus } = require('../database/models/orders');
const { upsertCustomer, addXp } = require('../database/models/customers');
const { buildCatalogView, parseCatalogState } = require('../utils/catalog');
const { buildCartView } = require('../utils/cartView');
const { buildPremiumEmbed } = require('../utils/embeds');
const { calculateTotal, formatCurrency } = require('../utils/format');
const { generatePixQr } = require('../utils/pix');
const { recommendProducts } = require('../utils/ai');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        const message = 'Ocorreu um erro ao executar este comando.';
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: message });
        } else {
          await interaction.reply({ content: message, ephemeral: true });
        }
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'catalog-category') {
      const category = interaction.values[0];
      const view = buildCatalogView({ category });
      return interaction.update({ embeds: [view.embed], components: view.components });
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('catalog-add-')) {
        const productId = Number(interaction.customId.split('catalog-add-')[1]);
        const product = getProduct(productId);
        if (!product) {
          return interaction.reply({ content: 'Produto não encontrado.', ephemeral: true });
        }
        const cart = getOrCreateCart(interaction.user.id);
        addItem(cart.id, productId, 1);
        const view = buildCartView(cart.id);
        return interaction.reply({ embeds: [view.embed], components: view.components, ephemeral: true });
      }

      if (interaction.customId.startsWith('catalog-prev-') || interaction.customId.startsWith('catalog-next-')) {
        const page = Number(interaction.customId.split('-').pop());
        const state = parseCatalogState(interaction.message.embeds[0]);
        const view = buildCatalogView({ category: state.category, page });
        return interaction.update({ embeds: [view.embed], components: view.components });
      }

      if (interaction.customId === 'cart-clear') {
        const cart = getOrCreateCart(interaction.user.id);
        clearCart(cart.id);
        const view = buildCartView(cart.id);
        return interaction.update({ embeds: [view.embed], components: view.components });
      }

      if (interaction.customId.startsWith('cart-increase-') || interaction.customId.startsWith('cart-decrease-') || interaction.customId.startsWith('cart-remove-')) {
        const action = interaction.customId.split('-')[1];
        const itemId = Number(interaction.customId.split('-').pop());
        const cart = getOrCreateCart(interaction.user.id);
        const items = listCartItems(cart.id);
        const target = items.find((item) => item.cart_item_id === itemId);
        if (!target) {
          return interaction.reply({ content: 'Item não encontrado.', ephemeral: true });
        }
        if (action === 'increase') updateItemQuantity(itemId, target.quantity + 1);
        if (action === 'decrease') updateItemQuantity(itemId, target.quantity - 1);
        if (action === 'remove') updateItemQuantity(itemId, 0);
        const view = buildCartView(cart.id);
        return interaction.update({ embeds: [view.embed], components: view.components });
      }

      if (interaction.customId === 'cart-checkout') {
        await interaction.deferReply({ ephemeral: true });
        const cart = getOrCreateCart(interaction.user.id);
        const items = listCartItems(cart.id);
        if (!items.length) {
          return interaction.editReply({ content: 'Seu carrinho está vazio.' });
        }

        const total = calculateTotal(items);
        const order = createOrder(interaction.user.id, items, total, 'PENDENTE');
        closeCart(cart.id);
        items.forEach((item) => decrementStock(item.product_id, item.quantity));
        upsertCustomer(interaction.user.id, interaction.user.username);
        addXp(interaction.user.id, Math.round(total));

        const { buffer, payload } = await generatePixQr({ amount: total, txid: `VIA${order.id}` });
        const attachment = new AttachmentBuilder(buffer, { name: `pix-${order.id}.png` });
        const embed = buildPremiumEmbed({
          title: 'Pagamento PIX',
          description: `Valor: ${formatCurrency(total)}\nStatus: **${order.status}**\nCopie o payload abaixo ou use o QR Code.`,
          fields: [{ name: 'Payload', value: `\`${payload}\`` }]
        });
        embed.setImage(`attachment://pix-${order.id}.png`);

        const recommendation = await recommendProducts({ cartItems: items });
        const recoEmbed = buildPremiumEmbed({
          title: 'Recomendação IA',
          description: recommendation
        });

        updateOrderStatus(order.id, 'PENDENTE');
        return interaction.editReply({ embeds: [embed, recoEmbed], files: [attachment] });
      }
    }
  }
};
