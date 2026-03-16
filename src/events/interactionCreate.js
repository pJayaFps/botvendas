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
const { db } = require('../database');
const { getOrCreateCart, addItem, listCartItems, updateItemQuantity, clearCart, closeCart, setCartCoupon, clearCartCoupon } = require('../database/models/cart');
const { getProduct, decrementStock, listProducts } = require('../database/models/products');
const { createOrder, listOrderItems, updateOrderStatus } = require('../database/models/orders');
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
const { createOrUpdateDelivery } = require('../database/models/deliveries');
const { getTicketSettings, upsertTicketSettings, createTicketRecord, getTicketByChannel, setTicketAssignee, closeTicketRecord } = require('../database/models/tickets');


const isStaffTicket = (member, settings) => {
  if (!settings?.staff_role_id) return false;
  return member?.roles?.cache?.has(settings.staff_role_id);
};

const isAllowedOpener = (member, settings) => {
  if (!settings?.opener_role_id) return true;
  return member?.roles?.cache?.has(settings.opener_role_id) || isStaffTicket(member, settings);
};

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
      if (interaction.customId === 'ticket-open') {
        const bot = getBotContext();
        const settings = getTicketSettings(bot.id, interaction.guildId);
        if (!settings) {
          return interaction.reply({ content: 'Sistema de tickets não configurado.', flags: MessageFlags.Ephemeral });
        }
        if (!isAllowedOpener(interaction.member, settings)) {
          return interaction.reply({ content: 'Você não tem permissão para abrir ticket.', flags: MessageFlags.Ephemeral });
        }

        const channelName = `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90);
        const channel = await interaction.guild.channels.create({
          name: channelName || `ticket-${interaction.user.id}`,
          type: ChannelType.GuildText,
          parent: settings.ticket_category_id || undefined,
          topic: `Ticket Suporte • Usuário ${interaction.user.id}`,
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
            ...(settings.staff_role_id ? [{ id: settings.staff_role_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : [])
          ]
        });

        createTicketRecord({ botId: bot.id, guildId: interaction.guildId, channelId: channel.id, openedBy: interaction.user.id });

        const openEmbed = buildPremiumEmbed({
          title: 'Ticket Aberto',
          description: settings.auto_message || 'Nosso time vai te atender em instantes.'
        });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket-member-panel').setLabel('Painel Membro').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ticket-staff-panel').setLabel('Painel Staff').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('ticket-exit').setLabel('Sair do Ticket').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('ticket-payment-confirmed').setLabel('Pagamento Confirmado').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('ticket-assume').setLabel('Assumir Ticket').setStyle(ButtonStyle.Secondary)
        );
        await channel.send({ content: `<@${interaction.user.id}>`, embeds: [openEmbed], components: [row] });
        return interaction.reply({ content: `Ticket criado: ${channel}`, flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'ticket-assume') {
        const ticket = getTicketByChannel(interaction.channelId);
        if (!ticket) return interaction.reply({ content: 'Use dentro de ticket.', flags: MessageFlags.Ephemeral });
        const bot = getBotContext();
        const settings = getTicketSettings(bot.id, interaction.guildId);
        if (!isStaffTicket(interaction.member, settings)) {
          return interaction.reply({ content: 'Apenas staff pode assumir.', flags: MessageFlags.Ephemeral });
        }
        setTicketAssignee(interaction.channelId, interaction.user.id);
        await interaction.channel.send({ content: `Este ticket foi assumido por ${interaction.user}.` });
        return interaction.reply({ content: 'Ticket assumido.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'ticket-member-panel') {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket-member-add').setLabel('Adicionar membro').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ticket-member-remove').setLabel('Remover membro').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ticket-member-notify').setLabel('Notificar staff').setStyle(ButtonStyle.Primary)
        );
        return interaction.reply({ content: 'Painel do membro:', components: [row], flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'ticket-staff-panel') {
        const bot = getBotContext();
        const settings = getTicketSettings(bot.id, interaction.guildId);
        if (!isStaffTicket(interaction.member, settings)) {
          return interaction.reply({ content: 'Apenas staff.', flags: MessageFlags.Ephemeral });
        }
        const row1 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket-staff-add').setLabel('Adicionar usuário').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ticket-staff-remove').setLabel('Remover usuário').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ticket-staff-rename').setLabel('Renomear').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('ticket-staff-close').setLabel('Fechar Ticket').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('ticket-staff-delete').setLabel('Deletar Ticket').setStyle(ButtonStyle.Danger)
        );
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket-staff-notify').setLabel('Notificar usuário').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('ticket-staff-resolve').setLabel('Marcar resolvido').setStyle(ButtonStyle.Success)
        );
        return interaction.reply({ content: 'Painel da staff:', components: [row1, row2], flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'ticket-exit') {
        const modal = new ModalBuilder().setCustomId('ticket-exit-modal').setTitle('Sair do ticket');
        const confirm = new TextInputBuilder().setCustomId('confirm').setLabel('Digite SAIR para confirmar').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(confirm));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'ticket-member-notify') {
        const bot = getBotContext();
        const settings = getTicketSettings(bot.id, interaction.guildId);
        const mention = settings?.staff_role_id ? `<@&${settings.staff_role_id}>` : '@staff';
        await interaction.channel.send({ content: `${mention} usuário solicitou atendimento no ticket.` });
        return interaction.reply({ content: 'Staff notificada.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'ticket-payment-confirmed' || interaction.customId === 'ticket-staff-resolve') {
        const bot = getBotContext();
        const settings = getTicketSettings(bot.id, interaction.guildId);
        if (!isStaffTicket(interaction.member, settings)) {
          return interaction.reply({ content: 'Apenas staff.', flags: MessageFlags.Ephemeral });
        }
        await interaction.channel.send({ content: `✅ ${interaction.user} confirmou pagamento/atendimento no ticket.` });
        return interaction.reply({ content: 'Ação registrada.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'ticket-staff-delete') {
        await interaction.reply({ content: 'Ticket será deletado.', flags: MessageFlags.Ephemeral });
        return interaction.channel.delete('Ticket deletado pela staff').catch(() => null);
      }

      if (interaction.customId === 'ticket-staff-add' || interaction.customId === 'ticket-member-add' || interaction.customId === 'ticket-staff-remove' || interaction.customId === 'ticket-member-remove') {
        const modal = new ModalBuilder().setCustomId(`${interaction.customId}-modal`).setTitle('Gerenciar usuário no ticket');
        const input = new TextInputBuilder().setCustomId('userId').setLabel('ID do usuário').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'ticket-staff-rename') {
        const modal = new ModalBuilder().setCustomId('ticket-rename-modal').setTitle('Renomear ticket');
        const input = new TextInputBuilder().setCustomId('name').setLabel('Novo nome').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'ticket-staff-close') {
        const modal = new ModalBuilder().setCustomId('ticket-close-modal').setTitle('Fechar ticket');
        const status = new TextInputBuilder().setCustomId('status').setLabel('Status final (resolvido/não)').setStyle(TextInputStyle.Short).setRequired(true);
        const notes = new TextInputBuilder().setCustomId('notes').setLabel('Observações rápidas').setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(status), new ActionRowBuilder().addComponents(notes));
        return interaction.showModal(modal);
      }

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
        const availableStock = Number(product.stock) || 0;
        if (availableStock <= 0) {
          return interaction.reply({ content: 'Produto sem estoque no momento.', flags: MessageFlags.Ephemeral });
        }
        const bot = getBotContext();
        const cart = getOrCreateCart(interaction.user.id, bot.id);
        const items = listCartItems(cart.id);
        const currentQuantity = items
          .filter((item) => item.product_id === productId)
          .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        if (currentQuantity + 1 > availableStock) {
          return interaction.reply({ content: 'Quantidade máxima em estoque atingida.', flags: MessageFlags.Ephemeral });
        }
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
        if (action === 'increase') {
          const product = getProduct(target.product_id);
          const availableStock = Number(product?.stock) || 0;
          if (!product || availableStock <= 0) {
            return interaction.reply({ content: 'Produto sem estoque no momento.', flags: MessageFlags.Ephemeral });
          }
          const currentQuantity = items
            .filter((item) => item.product_id === target.product_id)
            .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
          if (currentQuantity + 1 > availableStock) {
            return interaction.reply({ content: 'Quantidade máxima em estoque atingida.', flags: MessageFlags.Ephemeral });
          }
          updateItemQuantity(itemId, target.quantity + 1);
        }
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

        const quantityByProduct = new Map();
        items.forEach((item) => {
          const current = quantityByProduct.get(item.product_id) || 0;
          quantityByProduct.set(item.product_id, current + Number(item.quantity || 0));
        });
        const unavailable = [...quantityByProduct.entries()].find(([productId, quantity]) => {
          const product = getProduct(productId);
          const availableStock = Number(product?.stock) || 0;
          return !product || availableStock < quantity || availableStock <= 0;
        });
        if (unavailable) {
          return interaction.editReply({ content: 'Alguns itens estão sem estoque suficiente. Ajuste o carrinho antes de finalizar.' });
        }

        const total = calculateTotal(items);
        const coupon = cart.coupon_code ? getCouponByCode(cart.coupon_code) : null;
        const discountData = applyCouponDiscount(total, coupon);

        const decremented = [];
        for (const [productId, quantity] of quantityByProduct.entries()) {
          const result = decrementStock(productId, quantity);
          if (result?.changes) {
            decremented.push({ productId, quantity });
            continue;
          }
          decremented.forEach((entry) => {
            db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(entry.quantity, entry.productId);
          });
          return interaction.editReply({ content: 'Estoque reservado por outro checkout agora. Tente novamente em instantes.' });
        }

        const order = createOrder(interaction.user.id, items, discountData.total, 'PENDENTE', bot.id);
        closeCart(cart.id);
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
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId(`close-checkout-${order.id}`)
            .setLabel('Fechar atendimento')
            .setStyle(ButtonStyle.Danger)
        );

        embed.addFields({ name: 'Envie o comprovante', value: 'Envie aqui o comprovante do pagamento para análise.' });
        const paymentMessage = await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [actionRow], files: [attachment] });
        const { saveReceipt } = require('../utils/receiptStore');
        saveReceipt(order.id, {
          channelId: channel.id,
          userId: interaction.user.id,
          paymentMessageId: paymentMessage.id
        });

        const recommendation = await recommendProducts({ cartItems: items });
        const recoEmbed = buildPremiumEmbed({
          title: 'Recomendação IA',
          description: recommendation
        });
        await channel.send({ embeds: [recoEmbed] });

        updateOrderStatus(order.id, 'PENDENTE');
        return interaction.editReply({ content: `Checkout criado! Acesse ${channel} para finalizar o pagamento.` });
      }

      if (interaction.customId.startsWith('close-checkout-')) {
        const orderId = interaction.customId.split('-').pop();
        if (interaction.user.id !== interaction.client.config?.discord?.adminId && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: 'Apenas administrador pode fechar o atendimento.', flags: MessageFlags.Ephemeral });
        }

        const { clearReceipt } = require('../utils/receiptStore');
        const bot = getBotContext();
        const order = db.prepare('SELECT user_id, status FROM orders WHERE id = ?').get(orderId);
        if (!order) {
          return interaction.reply({ content: 'Pedido não encontrado.', flags: MessageFlags.Ephemeral });
        }

        if (order.status === 'PENDENTE') {
          const orderItems = listOrderItems(orderId);
          const quantityByProduct = new Map();
          orderItems.forEach((item) => {
            const current = quantityByProduct.get(item.product_id) || 0;
            quantityByProduct.set(item.product_id, current + Number(item.quantity || 0));
          });
          for (const [productId, quantity] of quantityByProduct.entries()) {
            db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(quantity, productId);
          }
        }

        updateOrderStatus(orderId, 'CANCELADO');
        if (order?.user_id) {
          updateSaleStatusByOrder(bot.id, order.user_id, 'cancelada');
        }
        clearReceipt(orderId);

        await interaction.reply({ content: 'Atendimento encerrado. Canal será fechado.', flags: MessageFlags.Ephemeral });
        await interaction.channel.send({ content: '❌ Atendimento finalizado sem pagamento. Canal encerrado.' }).catch(() => null);
        await interaction.channel.delete('Atendimento encerrado manualmente').catch(() => null);
        return;
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

        const channel = await interaction.client.channels.fetch(receipt.channelId);
        const toDelete = [receipt.paymentMessageId, receipt.receiptMessageId].filter(Boolean);
        for (const messageId of toDelete) {
          const message = await channel.messages.fetch(messageId).catch(() => null);
          if (message) await message.delete().catch(() => null);
        }

        const approvedEmbed = buildPremiumEmbed({
          title: 'Pagamento Confirmado',
          description: `✅ Pagamento confirmado! Obrigado pela sua compra.\n📦 Prazo de entrega: **3 dias**.`
        });
        await channel.send({ content: `<@${receipt.userId}>`, embeds: [approvedEmbed] });

        const receiptUser = await interaction.client.users.fetch(receipt.userId).catch(() => null);
        const baseName = receiptUser?.username || `user-${receipt.userId}`;
        const usernameSlug = baseName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');
        const initialName = `3d-${usernameSlug}`.slice(0, 100);
        await channel.setName(initialName).catch(() => null);

        createOrUpdateDelivery({
          orderId: Number(orderId),
          channelId: String(channel.id),
          userId: String(receipt.userId),
          usernameSlug,
          approvedAt: new Date().toISOString()
        });

        await interaction.reply({ content: 'Pagamento aprovado, PIX/comprovante removidos e prazo iniciado (3 dias).', flags: MessageFlags.Ephemeral });
        clearReceipt(orderId);
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
        const bot = getBotContext();
        updateSaleStatusByOrder(bot.id, receipt.userId, 'cancelada');
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

    if (interaction.isModalSubmit() && interaction.customId === 'ticket-panel-modal') {
      const bot = getBotContext();
      const data = {
        bot_id: bot.id,
        guild_id: interaction.guildId,
        panel_title: interaction.fields.getTextInputValue('title'),
        panel_description: interaction.fields.getTextInputValue('description'),
        ticket_category_id: interaction.fields.getTextInputValue('category'),
        staff_role_id: interaction.fields.getTextInputValue('staff'),
        opener_role_id: interaction.fields.getTextInputValue('openRole'),
        auto_message: 'Olá! Descreva seu atendimento para nossa equipe.',
        log_channel_id: null,
        closed_category_id: null,
        delete_after_seconds: 20,
        pix_qr_url: null,
        pix_key: null,
        pix_receiver: null,
        pix_embed_message: null,
        transcript_type: 'txt',
        transcript_channel_id: null,
        feedback_channel_id: null,
        updated_at: new Date().toISOString()
      };
      upsertTicketSettings(data);
      const embed = buildPremiumEmbed({ title: data.panel_title, description: data.panel_description });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket-open').setLabel('➡️ Abrir Ticket').setStyle(ButtonStyle.Primary)
      );
      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: 'Painel de ticket enviado e configuração salva.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket-exit-modal') {
      const value = interaction.fields.getTextInputValue('confirm').trim().toUpperCase();
      if (value !== 'SAIR') {
        return interaction.reply({ content: 'Confirmação inválida.', flags: MessageFlags.Ephemeral });
      }
      const ticket = getTicketByChannel(interaction.channelId);
      if (ticket && String(ticket.opened_by) === String(interaction.user.id)) {
        await interaction.channel.permissionOverwrites.delete(interaction.user.id).catch(() => null);
        return interaction.reply({ content: 'Você saiu do ticket.', flags: MessageFlags.Ephemeral });
      }
      return interaction.reply({ content: 'Você não é o autor do ticket.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.isModalSubmit() && interaction.customId.endsWith('-modal') && interaction.customId.includes('ticket-') && (interaction.customId.includes('add') || interaction.customId.includes('remove'))) {
      const userId = interaction.fields.getTextInputValue('userId').trim();
      const isRemove = interaction.customId.includes('remove');
      if (isRemove) {
        await interaction.channel.permissionOverwrites.delete(userId).catch(() => null);
        return interaction.reply({ content: 'Usuário removido do ticket.', flags: MessageFlags.Ephemeral });
      }
      await interaction.channel.permissionOverwrites.edit(userId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      }).catch(() => null);
      return interaction.reply({ content: 'Usuário adicionado ao ticket.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket-rename-modal') {
      const name = interaction.fields.getTextInputValue('name').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90);
      await interaction.channel.setName(name || 'ticket-renomeado').catch(() => null);
      return interaction.reply({ content: 'Ticket renomeado.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket-close-modal') {
      const ticket = getTicketByChannel(interaction.channelId);
      if (!ticket) return interaction.reply({ content: 'Canal não é ticket.', flags: MessageFlags.Ephemeral });
      const status = interaction.fields.getTextInputValue('status');
      const notes = interaction.fields.getTextInputValue('notes');

      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const lines = [...messages.values()]
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map((m) => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author?.tag || 'unknown'}: ${m.content || '[anexo/sem texto]'}`)
        .join('\n');
      const transcript = Buffer.from(lines || 'Sem mensagens no ticket.', 'utf8');
      const transcriptFile = new AttachmentBuilder(transcript, { name: `transcript-ticket-${interaction.channelId}.txt` });

      const user = await interaction.client.users.fetch(ticket.opened_by).catch(() => null);
      if (user) {
        const summary = buildPremiumEmbed({
          title: 'Resumo do Ticket',
          description: `Aberto por: <@${ticket.opened_by}>
Fechado por: <@${interaction.user.id}>
Atendido por: ${ticket.assumed_by ? `<@${ticket.assumed_by}>` : 'Não definido'}
Status final: ${status}
Observações: ${notes}`
        });
        const feedbackEmbed = buildPremiumEmbed({
          title: 'Avaliação do Atendimento',
          description: 'Avalie seu atendimento para nos ajudar a melhorar.'
        });
        const bot = getBotContext();
        const settings = getTicketSettings(bot.id, interaction.guildId);
        const feedbackUrl = settings?.feedback_channel_id ? `https://discord.com/channels/${interaction.guildId}/${settings.feedback_channel_id}` : 'https://discord.com/channels/@me';
        const fbRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(feedbackUrl).setLabel('Avaliar Atendimento'));
        await user.send({ embeds: [summary], files: [transcriptFile] }).catch(() => null);
        await user.send({ embeds: [feedbackEmbed], components: [fbRow] }).catch(() => null);
      }

      closeTicketRecord(interaction.channelId, interaction.user.id, status, notes);
      await interaction.reply({ content: 'Ticket fechado com transcript enviado.', flags: MessageFlags.Ephemeral });

      const bot = getBotContext();
      const settings = getTicketSettings(bot.id, interaction.guildId);
      if (settings?.closed_category_id) {
        await interaction.channel.setParent(settings.closed_category_id).catch(() => null);
        await interaction.channel.permissionOverwrites.edit(ticket.opened_by, { ViewChannel: false }).catch(() => null);
        return;
      }
      const delay = Number(settings?.delete_after_seconds || 20) * 1000;
      setTimeout(() => {
        interaction.channel.delete('Ticket fechado').catch(() => null);
      }, delay);
      return;
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
