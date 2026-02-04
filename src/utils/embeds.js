const { EmbedBuilder } = require('discord.js');
const config = require('../config');

const premiumHeader = (title) => {
  return `╔═══════════════════════════════╗\n║ 🔮 **${title}**\n╚═══════════════════════════════╝`;
};

const buildPremiumEmbed = ({ title, description, fields = [], thumbnail, image }) => {
  const embed = new EmbedBuilder()
    .setColor('#8a2be2')
    .setDescription(`${premiumHeader(title)}\n\n${description}`)
    .addFields(fields)
    .setTimestamp();

  const fallbackImage = `${config.web.baseUrl}/images/gradient.svg`;
  embed.setImage(image || fallbackImage);
  if (thumbnail) embed.setThumbnail(thumbnail);
  return embed;
};

module.exports = { buildPremiumEmbed, premiumHeader };
