const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { listProducts } = require('../database/models/products');
const { getOrCreateDefaultBot } = require('../database/models/bots');
const { buildPremiumEmbed } = require('../utils/embeds');
const { formatCurrency } = require('../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ofertas')
    .setDescription('Veja ofertas premium'),
  async execute(interaction) {
    const bot = getOrCreateDefaultBot();
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
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
