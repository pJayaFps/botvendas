const { AttachmentBuilder, MessageFlags, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getOrCreateCart, addItem, listCartItems, updateItemQuantity, clearCart, closeCart } = require('../database/models/cart');
const { getProduct, decrementStock, listProducts } = require('../database/models/products');
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
          await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
        }
      }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'catalog-category') {
      const category = interaction.values[0];
      const view = buildCatalogView({ category });
      return interaction.update({ embeds: [view.embed], components: view.components });
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'panel-open-catalog') {
        const view = buildCatalogView({});
        return interaction.reply({ embeds: [view.embed], components: view.components, flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'panel-open-offers') {
        const products = listProducts().slice(0, 3);
        const fields = products.map((product) => ({
          name: `${product.name} • ${formatCurrency(product.price)}`,
          value: product.description,
          inline: false
        }));
        const embed = buildPremiumEmbed({
          title: 'Ofertas Premium',
          description: 'Seleção especial com descontos VIP.',
          fields: fields.length ? fields : [{ name: 'Sem ofertas', value: 'Cadastre produtos para criar ofertas.' }],
          image: products[0]?.image_url || undefined
        });
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId.startsWith('catalog-add-')) {
        const productId = Number(interaction.customId.split('catalog-add-')[1]);
        const product = getProduct(productId);
        if (!product) {
          return interaction.reply({ content: 'Produto não encontrado.', flags: MessageFlags.Ephemeral });
        }
        const cart = getOrCreateCart(interaction.user.id);
        addItem(cart.id, productId, 1);
        const view = buildCartView(cart.id);
        return interaction.reply({ embeds: [view.embed], components: view.components, flags: MessageFlags.Ephemeral });
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
          return interaction.reply({ content: 'Item não encontrado.', flags: MessageFlags.Ephemeral });
        }
        if (action === 'increase') updateItemQuantity(itemId, target.quantity + 1);
        if (action === 'decrease') updateItemQuantity(itemId, target.quantity - 1);
        if (action === 'remove') updateItemQuantity(itemId, 0);
        const view = buildCartView(cart.id);
        return interaction.update({ embeds: [view.embed], components: view.components });
      }

      if (interaction.customId === 'cart-checkout') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
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

        if (!interaction.guild) {
          return interaction.editReply({ content: 'Este checkout precisa ser feito dentro de um servidor.' });
        }

        const channelName = `checkout-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        const channel = await interaction.guild.channels.create({
          name: channelName.slice(0, 90) || `checkout-${interaction.user.id}`,
          type: ChannelType.GuildText,
          topic: `Checkout VIA BOT • Pedido #${order.id}`,
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] }
          ]
        });

        const { buffer, payload } = await generatePixQr({ amount: total, txid: `VIA${order.id}` });
        const attachment = new AttachmentBuilder(buffer, { name: `pix-${order.id}.png` });
        const embed = buildPremiumEmbed({
          title: 'Pagamento PIX',
          description: `Valor: ${formatCurrency(total)}\nStatus: **PENDENTE**\nCopie o payload abaixo ou use o QR Code.`,
          fields: [{ name: 'Payload', value: payload ? `\`${payload}\`` : 'Payload indisponível, use o QR Code.' }]
        });
        embed.setImage(`attachment://pix-${order.id}.png`);

        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('payment-info')
            .setLabel('Aguardando pagamento automático')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

        embed.addFields({ name: 'Envie o comprovante', value: 'Envie aqui o comprovante do pagamento para análise.' });
        await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [actionRow], files: [attachment] });

        const recommendation = await recommendProducts({ cartItems: items });
        const recoEmbed = buildPremiumEmbed({
          title: 'Recomendação IA',
          description: recommendation
        });
        await channel.send({ embeds: [recoEmbed] });

        updateOrderStatus(order.id, 'PENDENTE');
        return interaction.editReply({ content: `Checkout criado! Acesse ${channel} para finalizar o pagamento.` });
      }

      if (interaction.customId.startsWith('receipt-approve-')) {
        const { getReceipt, clearReceipt } = require('../utils/receiptStore');
        const orderId = interaction.customId.split('-').pop();
        const receipt = getReceipt(orderId);
        if (!receipt) {
          return interaction.reply({ content: 'Comprovante não encontrado.', flags: MessageFlags.Ephemeral });
        }
        if (interaction.user.id !== interaction.client.config?.discord?.adminId && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: 'Apenas o administrador pode aprovar.', flags: MessageFlags.Ephemeral });
        }
        updateOrderStatus(orderId, 'APROVADO');
        const approvedEmbed = buildPremiumEmbed({
          title: 'Pagamento Aprovado',
          description: '✅ Pagamento confirmado! Obrigado pela sua compra.'
        });
        const channel = await interaction.client.channels.fetch(receipt.channelId);
        await channel.send({ content: `<@${receipt.userId}>`, embeds: [approvedEmbed] });
        await interaction.reply({ content: 'Pagamento aprovado e cliente notificado.', flags: MessageFlags.Ephemeral });
        await channel.send({ content: 'Este canal será deletado em instantes...' });
        clearReceipt(orderId);
        setTimeout(async () => {
          await channel.delete('Checkout finalizado');
        }, 20000);
      }

      if (interaction.customId.startsWith('receipt-reject-')) {
        const { getReceipt, clearReceipt } = require('../utils/receiptStore');
        const orderId = interaction.customId.split('-').pop();
        const receipt = getReceipt(orderId);
        if (!receipt) {
          return interaction.reply({ content: 'Comprovante não encontrado.', flags: MessageFlags.Ephemeral });
        }
        if (interaction.user.id !== interaction.client.config?.discord?.adminId && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: 'Apenas o administrador pode reprovar.', flags: MessageFlags.Ephemeral });
        }
        updateOrderStatus(orderId, 'CANCELADO');
        const rejectedEmbed = buildPremiumEmbed({
          title: 'Pagamento Não Confirmado',
          description: '❌ Não identificamos o pagamento. Envie outro comprovante.'
        });
        const channel = await interaction.client.channels.fetch(receipt.channelId);
        await channel.send({ content: `<@${receipt.userId}>`, embeds: [rejectedEmbed] });
        await interaction.reply({ content: 'Pagamento reprovado e cliente notificado.', flags: MessageFlags.Ephemeral });
        clearReceipt(orderId);
      }

    }
  }
};
