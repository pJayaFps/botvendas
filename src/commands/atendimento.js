const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { buildPremiumEmbed } = require('../utils/embeds');
const { answerSupport } = require('../utils/ai');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('atendimento')
    .setDescription('Fale com o atendimento inteligente')
    .addStringOption((option) => option.setName('mensagem').setDescription('Sua dúvida')),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const question = interaction.options.getString('mensagem') || 'Olá, quero ajuda com produtos e entrega.';
    const response = await answerSupport({ question });
    const embed = buildPremiumEmbed({
      title: 'Atendimento IA',
      description: response
    });
    await interaction.editReply({ embeds: [embed] });
  }
};
