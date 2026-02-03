const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { upsertCustomer } = require('../database/models/customers');
const { buildPremiumEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Veja seu perfil de comprador'),
  async execute(interaction) {
    const customer = upsertCustomer(interaction.user.id, interaction.user.username);
    const embed = buildPremiumEmbed({
      title: 'Perfil do Cliente',
      description: `Bem-vindo, ${customer.name}!`,
      fields: [
        { name: 'Nível', value: String(customer.level), inline: true },
        { name: 'XP', value: String(customer.xp), inline: true },
        { name: 'Vantagem atual', value: customer.level >= 10 ? 'Frete grátis' : customer.level >= 5 ? 'Atendimento VIP' : '5% OFF' }
      ]
    });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
