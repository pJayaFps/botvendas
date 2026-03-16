const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { createCoupon } = require('../database/models/coupons');
const { getBotContext } = require('../database/models/bots');
const { buildPremiumEmbed } = require('../utils/embeds');
const { isAdmin } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('criarcupom')
    .setDescription('Criar cupom (admin)')
    .addStringOption((option) => option.setName('codigo').setDescription('Código do cupom').setRequired(true))
    .addStringOption((option) =>
      option
        .setName('tipo')
        .setDescription('Tipo de cupom')
        .setRequired(true)
        .addChoices(
          { name: 'porcentagem', value: 'porcentagem' },
          { name: 'valor', value: 'valor' },
          { name: 'frete', value: 'frete' }
        )
    )
    .addNumberOption((option) => option.setName('valor').setDescription('Valor do desconto').setRequired(true))
    .addIntegerOption((option) => option.setName('nivelmin').setDescription('Nível mínimo').setRequired(false))
    .addIntegerOption((option) =>
      option.setName('limite').setDescription('Quantidade máxima de usos').setRequired(false)
    ),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'Apenas administradores podem usar este comando.', flags: MessageFlags.Ephemeral });
    }

    const bot = getBotContext();
    const data = {
      bot_id: bot.id,
      code: interaction.options.getString('codigo'),
      type: interaction.options.getString('tipo'),
      value: interaction.options.getNumber('valor'),
      min_level: interaction.options.getInteger('nivelmin') || 1,
      max_uses: interaction.options.getInteger('limite') || null
    };

    createCoupon(data);
    const embed = buildPremiumEmbed({
      title: 'Cupom Criado',
      description: `Cupom ${data.code} criado com sucesso.`
    });
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
