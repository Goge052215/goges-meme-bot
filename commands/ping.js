const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Pings the bot and shows the latency'),
    
  execute: async (interaction, client) => {
    const latency = Date.now() - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);
    
    let response = `🏓 Pong! Bot latency is ${latency}ms. API latency is ${apiLatency}ms.`;
    
    if (latency < 50) {
      response += "\nWow, that's lightning fast! ⚡";
    } else if (latency < 200) {
      response += "\nPretty good speed! 👍";
    } else {
      response += "\nI might be a bit slow today... 🐢";
    }
    
    return interaction.reply(response);
  },
}; 