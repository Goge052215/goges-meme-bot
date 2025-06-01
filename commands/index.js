const fs = require('fs');
const path = require('path');

const loadCommands = () => {
  const commands = [];
  const commandFiles = {};
  const commandsPath = path.join(__dirname);
  const commandFilePaths = fs.readdirSync(commandsPath).filter(file => 
    file.endsWith('.js') && !file.startsWith('index')
  );

  for (const file of commandFilePaths) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      commandFiles[command.data.name] = command;
      console.log(`Loaded command: ${command.data.name}`);
    } else {
      console.warn(`The command at ${filePath} is missing required "data" or "execute" property.`);
    }
  }
  
  return { commands, commandFiles };
};

module.exports = { loadCommands }; 