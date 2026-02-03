const { SlashCommandBuilder } = require('discord.js');
const { updateProduct, getProduct } = require('../database/models/products');
const { buildPremiumEmbed } = require('../utils/embeds');
const { isAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editarproduto')
    .setDescription('Editar produto do catálogo (admin)')
    .addIntegerOption((option) => option.setName('id').setDescription('ID do produto').setRequired(true))
    .addStringOption((option) => option.setName('nome').setDescription('Nome do produto'))
    .addStringOption((option) => option.setName('descricao').setDescription('Descrição curta'))
    .addNumberOption((option) => option.setName('preco').setDescription('Preço'))
    .addStringOption((option) => option.setName('categoria').setDescription('Categoria'))
    .addIntegerOption((option) => option.setName('estoque').setDescription('Estoque'))
    .addStringOption((option) => option.setName('imagem').setDescription('URL da imagem premium'))
    .addBooleanOption((option) => option.setName('ativo').setDescription('Produto ativo?')),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'Apenas administradores podem usar este comando.', ephemeral: true });
    }

    const id = interaction.options.getInteger('id');
    const product = getProduct(id);
    if (!product) {
      return interaction.reply({ content: 'Produto não encontrado.', ephemeral: true });
    }

    const data = {
      name: interaction.options.getString('nome') || product.name,
      description: interaction.options.getString('descricao') || product.description,
      price: interaction.options.getNumber('preco') ?? product.price,
      category: interaction.options.getString('categoria') || product.category,
      stock: interaction.options.getInteger('estoque') ?? product.stock,
      image_url: interaction.options.getString('imagem') || product.image_url,
      active: interaction.options.getBoolean('ativo') ?? product.active
    };

    updateProduct(id, data);
    const embed = buildPremiumEmbed({
      title: 'Produto Atualizado',
      description: `Produto #${id} atualizado com sucesso.`
    });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
