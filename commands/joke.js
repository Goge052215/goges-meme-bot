const { SlashCommandBuilder } = require('@discordjs/builders');
const fetch = require('node-fetch');

async function getJoke() {
  try {
    const response = await fetch('https://official-joke-api.appspot.com/random_joke');
    const data = await response.json();
    return `**${data.setup}**\n${data.punchline}`;
  } catch (error) {
    console.error('Error fetching joke:', error);
    return 'Error fetching joke. Please try again later.';
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('joke')
    .setDescription('Get a random joke'),
    
  execute: async (interaction) => {
    await interaction.deferReply();
    const joke = await getJoke();
    return interaction.editReply(joke);
  },
  getJoke
}; 