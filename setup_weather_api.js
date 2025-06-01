const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function setupWeatherAPI() {
  console.log('\n=== OpenWeatherMap API Setup ===');
  console.log('\nThis script will help you set up your OpenWeatherMap API key.');
  console.log('\nFollow these steps to get your free API key:');
  console.log('1. Go to https://home.openweathermap.org/users/sign_up and create a free account');
  console.log('2. After signing in, go to https://home.openweathermap.org/api_keys');
  console.log('3. Create a new API key (or use the default one)');
  console.log('4. Copy the API key and paste it below');
  console.log('\nNote: It may take a few hours for a new API key to activate.');
  
  const apiKey = await new Promise(resolve => {
    rl.question('\nEnter your OpenWeatherMap API key: ', answer => {
      resolve(answer.trim());
    });
  });
  
  if (!apiKey) {
    console.log('\nNo API key provided. Setup cancelled.');
    rl.close();
    return;
  }
  
  const envPath = path.join(__dirname, '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  if (envContent.includes('WEATHER_API_KEY=')) {
    envContent = envContent.replace(/WEATHER_API_KEY=.*/g, `WEATHER_API_KEY=${apiKey}`);
  } else {
    envContent += `\nWEATHER_API_KEY=${apiKey}\n`;
  }
  
  fs.writeFileSync(envPath, envContent);
  
  console.log('\n✅ API key saved successfully to .env file!');
  console.log('\nTo use this API key in your bot:');
  console.log('1. Install dotenv: npm install dotenv');
  console.log('2. Add "require(\'dotenv\').config();" at the top of your replit_memebot.js file');
  
  const shouldUpdate = await new Promise(resolve => {
    rl.question('\nWould you like to automatically update your bot file to use dotenv? (y/n): ', answer => {
      resolve(answer.toLowerCase() === 'y');
    });
  });
  
  if (shouldUpdate) {
    try {
      require('dotenv');
    } catch (error) {
      console.log('\nInstalling dotenv package...');
      require('child_process').execSync('npm install dotenv', { stdio: 'inherit' });
      console.log('dotenv installed successfully!');
    }
    
    const botFilePath = path.join(__dirname, 'replit_memebot.js');
    if (fs.existsSync(botFilePath)) {
      let botFileContent = fs.readFileSync(botFilePath, 'utf8');
      
      if (!botFileContent.includes('require(\'dotenv\').config()') && !botFileContent.includes('require("dotenv").config()')) {
        botFileContent = `require('dotenv').config();\n${botFileContent}`;
        fs.writeFileSync(botFilePath, botFileContent);
        console.log('\n✅ Added dotenv configuration to your bot file!');
      } else {
        console.log('\nYour bot file already has dotenv configured!');
      }
    } else {
      console.log('\n❌ Could not find your bot file. Please add dotenv configuration manually.');
    }
  }
  
  console.log('\n🎉 Setup complete! Your weather command should now use real weather data.');
  console.log('If you encounter any issues, double check that:');
  console.log('1. Your API key is correct');
  console.log('2. You\'ve added the dotenv configuration to your bot file');
  console.log('3. New API keys may take a few hours to activate\n');
  
  rl.close();
}

setupWeatherAPI(); 