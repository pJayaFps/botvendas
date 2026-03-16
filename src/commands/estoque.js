const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { listProducts } = require('../database/models/products');
const { buildPremiumEmbed } = require('../utils/embeds');
const { isAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('estoque')
    .setDescription('Ver estoque (admin)'),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'Apenas administradores podem usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const products = listProducts().slice(0, 10);
    const fields = products.map((product) => ({
      name: `${product.name} (#${product.id})`,
      value: `Categoria: ${product.category} | Estoque: ${product.stock}`,
      inline: false
    }));

    const embed = buildPremiumEmbed({
      title: 'Estoque',
      description: 'Status premium do estoque.',
      fields: fields.length ? fields : [{ name: 'Sem produtos', value: 'Cadastre produtos para ver estoque.' }]
    });

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
