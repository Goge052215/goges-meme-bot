const { SlashCommandBuilder } = require('@discordjs/builders');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all available commands'),
    
  execute: async (interaction) => {
    const commandsPath = path.join(__dirname);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => 
      file.endsWith('.js') && !file.startsWith('index') && file !== 'help.js'
    );
    
    let helpText = "**📋 Available Commands**\n\n";
    
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = require(filePath);
      
      if ('data' in command && 'execute' in command) {
        helpText += `• **/${command.data.name}** - ${command.data.description}\n`;
      }
    }
    
    helpText += `• **/help** - List all available commands\n\n`;
    helpText += `To use a command, simply type / and select from the menu that appears.`;
    
    return interaction.reply({
      content: helpText,
      ephemeral: true
    });
  }
}; 