const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { listProducts } = require('../database/models/products');
const { buildPremiumEmbed } = require('./embeds');
const { formatCurrency } = require('./format');

const buildCatalogView = ({ botId = 1, category, page = 0 }) => {
  const products = listProducts(botId, category);
  const categories = [...new Set(listProducts(botId).map((product) => product.category))];
  const paginated = products.slice(page * 4, page * 4 + 4);

  const fields = paginated.map((product) => ({
    name: `${product.name} • ${formatCurrency(product.price)}`,
    value: `${product.description}\n**Estoque:** ${product.stock}`,
    inline: false
  }));

  const embed = buildPremiumEmbed({
    title: category ? `Catálogo: ${category}` : 'Catálogo Premium',
    description: 'Selecione uma categoria e monte seu carrinho futurista.',
    fields: fields.length ? fields : [{ name: 'Sem produtos', value: 'Nenhum produto disponível nesta categoria.' }],
    thumbnail: paginated[0]?.image_url || undefined,
    image: paginated[0]?.image_url || undefined
  });

  embed.setFooter({ text: `BOT:${botId}|CAT:${category || 'ALL'}|PAGE:${page}` });

  const rows = [];
  if (categories.length) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('catalog-category')
      .setPlaceholder('Escolha uma categoria')
      .addOptions(categories.map((cat) => ({ label: cat, value: cat })));
    rows.push(new ActionRowBuilder().addComponents(select));
  }

  const buttons = paginated.map((product) =>
    new ButtonBuilder()
      .setCustomId(`catalog-add-${product.id}`)
      .setStyle(ButtonStyle.Primary)
      .setLabel(`Adicionar ${product.name}`)
  );

  if (buttons.length) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(0, 5)));
  }

  const totalPages = Math.ceil(products.length / 4);
  if (totalPages > 1) {
    const navRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`catalog-prev-${Math.max(page - 1, 0)}`)
        .setLabel('⬅️ Voltar')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId(`catalog-next-${Math.min(page + 1, totalPages - 1)}`)
        .setLabel('Avançar ➡️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1)
    );
    rows.push(navRow);
  }

  return { embed, components: rows, total: products.length };
};

const parseCatalogState = (embed) => {
  const footer = embed?.footer?.text || '';
  const [botPart, catPart, pagePart] = footer.split('|');
  const botId = Number(botPart?.replace('BOT:', '')) || 1;
  const category = catPart?.replace('CAT:', '') || 'ALL';
  const page = Number(pagePart?.replace('PAGE:', '')) || 0;
  return { botId, category: category === 'ALL' ? undefined : category, page };
};

module.exports = { buildCatalogView, parseCatalogState };
