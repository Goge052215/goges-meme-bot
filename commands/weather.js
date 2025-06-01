const { SlashCommandBuilder } = require('@discordjs/builders');
const fetch = require('node-fetch');

async function getWeather(city) {
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.cod !== 200) {
      console.error('Weather API error:', data.message);
      return null;
    }
    
    return {
      city: data.name,
      country: data.sys.country,
      temperature: Math.round(data.main.temp),
      feels_like: Math.round(data.main.feels_like),
      condition: data.weather[0].main,
      description: data.weather[0].description,
      humidity: data.main.humidity,
      wind_speed: data.wind.speed,
      icon: data.weather[0].icon
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
}

function getWeatherIconURL(iconCode) {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get weather information for a city')
    .addStringOption(option => 
      option.setName('city')
        .setDescription('The city to get weather for')
        .setRequired(true)),
    
  execute: async (interaction) => {
    const city = interaction.options.getString('city');
    await interaction.deferReply();
    
    const weather = await getWeather(city);
    
    if (!weather) {
      return interaction.editReply(`Could not fetch weather data for "${city}". Please check the city name and try again.`);
    }
    
    const response = `**Weather for ${weather.city}${weather.country ? `, ${weather.country}` : ''}**
🌡️ **Temperature:** ${weather.temperature}°C (Feels like: ${weather.feels_like}°C)
🌤️ **Condition:** ${weather.condition} - ${weather.description}
💧 **Humidity:** ${weather.humidity}%
💨 **Wind Speed:** ${weather.wind_speed} m/s

${getWeatherIconURL(weather.icon)}`;
    
    return interaction.editReply(response);
  },
  getWeather
}; 