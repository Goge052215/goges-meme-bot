const { SlashCommandBuilder } = require('@discordjs/builders');
const fetch = require('node-fetch');

// Function to get a random meme
async function getMeme() {
  try {
    const response = await fetch('https://meme-api.com/gimme');
    const data = await response.json();
    return data.url;
  } catch (error) {
    console.error('Error fetching meme:', error);
    return 'Error fetching meme. Please try again later.';
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Sends a random meme'),
    
  execute: async (interaction) => {
    await interaction.deferReply();
    const memeUrl = await getMeme();
    return interaction.editReply(memeUrl);
  },
  getMeme // Export the getMeme function
}; 