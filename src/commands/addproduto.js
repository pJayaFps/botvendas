const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createProduct } = require('../database/models/products');
const { getOrCreateDefaultBot } = require('../database/models/bots');
const { buildPremiumEmbed } = require('../utils/embeds');
const { isAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addproduto')
    .setDescription('Adicionar produto ao catálogo (admin)')
    .addStringOption((option) => option.setName('nome').setDescription('Nome do produto').setRequired(true))
    .addStringOption((option) => option.setName('descricao').setDescription('Descrição curta').setRequired(true))
    .addNumberOption((option) => option.setName('preco').setDescription('Preço').setRequired(true))
    .addStringOption((option) => option.setName('categoria').setDescription('Categoria').setRequired(true))
    .addIntegerOption((option) => option.setName('estoque').setDescription('Quantidade em estoque').setRequired(true))
    .addStringOption((option) => option.setName('imagem').setDescription('URL da imagem premium')),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'Apenas administradores podem usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const bot = getOrCreateDefaultBot();
    const data = {
      bot_id: bot.id,
      name: interaction.options.getString('nome'),
      description: interaction.options.getString('descricao'),
      price: interaction.options.getNumber('preco'),
      category: interaction.options.getString('categoria'),
      stock: interaction.options.getInteger('estoque'),
      image_url: interaction.options.getString('imagem')
    };

    const id = createProduct(data);
    const embed = buildPremiumEmbed({
      title: 'Produto Adicionado',
      description: `Produto ${data.name} cadastrado com sucesso (#${id}).`
    });
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
