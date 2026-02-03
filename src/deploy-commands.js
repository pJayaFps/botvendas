const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('./config');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(config.discord.token);

(async () => {
  try {
    console.log('[DEPLOY] Registrando comandos...');
    if (config.discord.guildId) {
      await rest.put(Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId), { body: commands });
      console.log('[DEPLOY] Comandos registrados para o servidor.');
    } else {
      await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commands });
      console.log('[DEPLOY] Comandos registrados globalmente.');
    }
  } catch (error) {
    console.error('[DEPLOY] Erro ao registrar comandos', error);
  }
})();
