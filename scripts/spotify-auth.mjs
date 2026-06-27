import express from 'express';
import SpotifyWebApi from 'spotify-web-api-node';
import open from 'open';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = 'https://jhcooks.in/';

if (!clientId || !clientSecret) {
  console.error("❌ SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is missing in .env.local!");
  process.exit(1);
}

const spotifyApi = new SpotifyWebApi({
  clientId,
  clientSecret,
  redirectUri
});

import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function startAuth() {
  const scopes = ['playlist-read-private', 'playlist-read-collaborative'];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes, 'state');
  
  console.log('\n🚀 Starting Spotify Authentication...');
  console.log('Opening your browser to log in to Spotify...');
  
  setTimeout(() => {
    open(authorizeURL);
  }, 2000);

  console.log('\n======================================================');
  console.log('IMPORTANT: After you log in, Spotify will redirect you to your website (jhcooks.in).');
  console.log('The page might look normal or broken, but look at the URL bar at the top of your browser!');
  console.log('It will look something like this: https://jhcooks.in/?code=AQD...&state=state');
  console.log('======================================================\n');

  rl.question('👉 Please COPY the ENTIRE URL from your browser and PASTE it here: ', async (answer) => {
    try {
      // Extract code from URL
      const url = new URL(answer.trim());
      const code = url.searchParams.get('code');
      
      if (!code) {
        console.error("❌ Could not find the 'code' parameter in the URL. Please try again.");
        process.exit(1);
      }

      const data = await spotifyApi.authorizationCodeGrant(code);
      const refreshToken = data.body['refresh_token'];
      
      // Save to .env.local
      const envPath = path.resolve('.env.local');
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      if (envContent.includes('SPOTIFY_REFRESH_TOKEN=')) {
        envContent = envContent.replace(/SPOTIFY_REFRESH_TOKEN=.*/, `SPOTIFY_REFRESH_TOKEN=${refreshToken}`);
      } else {
        envContent += `\nSPOTIFY_REFRESH_TOKEN=${refreshToken}\n`;
      }
      
      fs.writeFileSync(envPath, envContent);
      
      console.log("\n✅ SUCCESS! Refresh Token has been successfully saved to .env.local!");
      process.exit(0);
      
    } catch (err) {
      console.error("\n❌ Error during authorization:", err.message);
      process.exit(1);
    }
  });
}

startAuth();
