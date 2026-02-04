const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { listCoupons } = require('../database/models/coupons');
const { getBotContext } = require('../database/models/bots');
const { buildPremiumEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cupons')
    .setDescription('Veja cupons disponíveis'),
  async execute(interaction) {
    const bot = getBotContext();
    const coupons = listCoupons(bot.id);
    const fields = coupons.map((coupon) => ({
      name: `${coupon.code} (${coupon.type})`,
      value: `Valor: ${coupon.value} | Nível mínimo: ${coupon.min_level}`,
      inline: false
    }));
    const embed = buildPremiumEmbed({
      title: 'Cupons Ativos',
      description: 'Economize com nossos cupons secretos.',
      fields: fields.length ? fields : [{ name: 'Sem cupons', value: 'Nenhum cupom ativo no momento.' }]
    });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
