const {
  AttachmentBuilder,
  MessageFlags,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { getOrCreateCart, addItem, listCartItems, updateItemQuantity, clearCart, closeCart, setCartCoupon, clearCartCoupon } = require('../database/models/cart');
const { getProduct, decrementStock, listProducts } = require('../database/models/products');
const { createOrder, updateOrderStatus } = require('../database/models/orders');
const { upsertCustomer, addXp, getCustomer } = require('../database/models/customers');
const { getBotContext } = require('../database/models/bots');
const { createSale, updateSaleStatusByOrder } = require('../database/models/sales');
const { buildCatalogView, parseCatalogState } = require('../utils/catalog');
const { buildCartView } = require('../utils/cartView');
const { buildPremiumEmbed } = require('../utils/embeds');
const { calculateTotal, formatCurrency } = require('../utils/format');
const { generatePixQr } = require('../utils/pix');
const { recommendProducts } = require('../utils/ai');
const { getCouponByCode, incrementCouponUsage } = require('../database/models/coupons');
const { applyCouponDiscount } = require('../utils/coupons');

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
      const bot = getBotContext();
      const view = buildCatalogView({ botId: bot.id, category });
      return interaction.update({ embeds: [view.embed], components: view.components });
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'panel-open-catalog') {
        const bot = getBotContext();
        const view = buildCatalogView({ botId: bot.id });
        return interaction.reply({ embeds: [view.embed], components: view.components, flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'panel-open-offers') {
        const bot = getBotContext();
        const products = listProducts(bot.id).slice(0, 3);
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
        const bot = getBotContext();
        const cart = getOrCreateCart(interaction.user.id, bot.id);
        addItem(cart.id, productId, 1, bot.id);
        const view = buildCartView(cart.id);
        return interaction.reply({ embeds: [view.embed], components: view.components, flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId.startsWith('catalog-prev-') || interaction.customId.startsWith('catalog-next-')) {
        const page = Number(interaction.customId.split('-').pop());
        const state = parseCatalogState(interaction.message.embeds[0]);
        const view = buildCatalogView({ botId: state.botId, category: state.category, page });
        return interaction.update({ embeds: [view.embed], components: view.components });
      }

      if (interaction.customId === 'cart-clear') {
        const bot = getBotContext();
        const cart = getOrCreateCart(interaction.user.id, bot.id);
        clearCart(cart.id);
        const view = buildCartView(cart.id);
        return interaction.update({ embeds: [view.embed], components: view.components });
      }

      if (interaction.customId.startsWith('cart-increase-') || interaction.customId.startsWith('cart-decrease-') || interaction.customId.startsWith('cart-remove-')) {
        const action = interaction.customId.split('-')[1];
        const itemId = Number(interaction.customId.split('-').pop());
        const bot = getBotContext();
        const cart = getOrCreateCart(interaction.user.id, bot.id);
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

      if (interaction.customId === 'cart-coupon') {
        const modal = new ModalBuilder().setCustomId('cart-coupon-modal').setTitle('Aplicar cupom');
        const input = new TextInputBuilder()
          .setCustomId('coupon-code')
          .setLabel('Código do cupom')
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'cart-coupon-clear') {
        const bot = getBotContext();
        const cart = getOrCreateCart(interaction.user.id, bot.id);
        clearCartCoupon(cart.id);
        const view = buildCartView(cart.id);
        return interaction.update({ embeds: [view.embed], components: view.components });
      }

      if (interaction.customId === 'cart-checkout') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const bot = getBotContext();
        const cart = getOrCreateCart(interaction.user.id, bot.id);
        const items = listCartItems(cart.id);
        if (!items.length) {
          return interaction.editReply({ content: 'Seu carrinho está vazio.' });
        }

        const total = calculateTotal(items);
        const coupon = cart.coupon_code ? getCouponByCode(cart.coupon_code) : null;
        const discountData = applyCouponDiscount(total, coupon);
        const order = createOrder(interaction.user.id, items, discountData.total, 'PENDENTE', bot.id);
        closeCart(cart.id);
        items.forEach((item) => decrementStock(item.product_id, item.quantity));
        upsertCustomer(interaction.user.id, interaction.user.username, bot.id);
        addXp(interaction.user.id, Math.round(discountData.total), bot.id);
        const discountRatio = total > 0 ? discountData.total / total : 1;
        items.forEach((item) => {
          createSale({
            bot_id: bot.id,
            user_discord: interaction.user.id,
            valor: item.price * item.quantity * discountRatio,
            produto: item.name,
            quantidade: item.quantity,
            status: 'pendente',
            data: new Date().toISOString()
          });
        });
        if (coupon) {
          incrementCouponUsage(coupon.id);
        }

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

        const { buffer, payload } = await generatePixQr({ amount: discountData.total, txid: `VIA${order.id}` });
        const attachment = new AttachmentBuilder(buffer, { name: `pix-${order.id}.png` });
        const couponLine = coupon ? `\nCupom: **${coupon.code}**` : '';
        const discountLine = coupon && discountData.discount ? `\nDesconto: ${formatCurrency(discountData.discount)}` : '';
        const embed = buildPremiumEmbed({
          title: 'Pagamento PIX',
          description: `Valor: ${formatCurrency(discountData.total)}${discountLine}${couponLine}\nStatus: **PENDENTE**\nCopie o payload abaixo ou use o QR Code.`,
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
        const bot = getBotContext();
        updateSaleStatusByOrder(bot.id, receipt.userId, 'paga');
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

    if (interaction.isModalSubmit() && interaction.customId === 'cart-coupon-modal') {
      const code = interaction.fields.getTextInputValue('coupon-code').trim();
      if (!code) {
        return interaction.reply({ content: 'Informe um código de cupom válido.', flags: MessageFlags.Ephemeral });
      }
      const coupon = getCouponByCode(code);
      if (!coupon) {
        return interaction.reply({ content: 'Cupom não encontrado ou inativo.', flags: MessageFlags.Ephemeral });
      }
      if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
        return interaction.reply({ content: 'Este cupom já atingiu o limite de usos.', flags: MessageFlags.Ephemeral });
      }

      const bot = getBotContext();
      const cart = getOrCreateCart(interaction.user.id, bot.id);
      const customer = getCustomer(interaction.user.id, bot.id);
      if (coupon.min_level && (customer?.level || 1) < coupon.min_level) {
        return interaction.reply({ content: `Cupom exige nível mínimo ${coupon.min_level}.`, flags: MessageFlags.Ephemeral });
      }

      setCartCoupon(cart.id, coupon.code);
      const view = buildCartView(cart.id);
      return interaction.reply({ embeds: [view.embed], components: view.components, flags: MessageFlags.Ephemeral });
    }
  }
};
