
'use strict';

require('dotenv').config();

const express = require('express');
const mineflayer = require('mineflayer');

const app = express();
const PORT = Number(process.env.PORT || 10000);

const CONFIG = {
  host: process.env.MC_HOST || 'blastmc.mangoohost.live',
  port: Number(process.env.MC_PORT || 20987),
  version: process.env.MC_VERSION || 'auto',
  username: process.env.BOT_USERNAME || 'BlastMC_AFk',
  loginPassword: process.env.AUTHME_PASSWORD || '',
  registerPassword: process.env.AUTHME_REGISTER_PASSWORD || ''
};

let bot = null;
let online = false;
let reconnectTimer = null;
let retryDelay = 30000;
let stopping = false;
let moveTimer = null;
let jumpTimer = null;

function log(message) {
  console.log(`[BlastMC AFK] ${message}`);
}

function stopMovement() {
  if (moveTimer) clearInterval(moveTimer);
  if (jumpTimer) clearInterval(jumpTimer);

  moveTimer = null;
  jumpTimer = null;
}

function scheduleReconnect() {
  if (stopping || reconnectTimer) return;

  online = false;
  stopMovement();

  const wait = retryDelay;
  log(`Reconnecting in ${wait / 1000} seconds...`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    retryDelay = Math.min(retryDelay * 2, 60000);
    connectBot();
  }, wait);
 }

function connectBot() {
  if (stopping || bot || reconnectTimer) return;

  log(`Connecting to ${CONFIG.host}:${CONFIG.port}`);

  try {
    const options = {
      host: CONFIG.host,
      port: CONFIG.port,
      username: CONFIG.username,
      auth: 'offline'
    };

    options.version =
      CONFIG.version.toLowerCase() === 'auto'
        ? false
        : CONFIG.version;

    bot = mineflayer.createBot(options);

    bot.once('spawn', () => {
      online = true;
      retryDelay = 30000;

      log('Bot joined the Minecraft server.');

      setTimeout(() => {
        if (!bot || !online) return;

        if (CONFIG.loginPassword) {
          bot.chat(`/login ${CONFIG.loginPassword}`);
        }
      }, 1500);

      moveTimer = setInterval(() => {
        if (!bot || !online) return;

        const directions = [
          'forward',
          'back',
          'left',
          'right'
        ];

        const direction =
          directions[Math.floor(Math.random() * directions.length)];

        try {
          bot.clearControlStates();
          bot.setControlState(direction, true);

          setTimeout(() => {
            try {
              if (bot) bot.clearControlStates();
            } catch (_) {}
          }, 700);
        } catch (error) {
          log(`Movement error: ${error.message}`);
        }
      }, 3000);

      jumpTimer = setInterval(() => {
        if (!bot || !online) return;

        try {
          bot.setControlState('jump', true);

          setTimeout(() => {
            try {
              if (bot) bot.setControlState('jump', false);
            } catch (_) {}
          }, 250);
        } catch (_) {}
      }, 6000);
    });

    bot.on('messagestr', message => {
      if (!bot) return;

      const text = message.toLowerCase();

      if (
        /\/login|please login|please log in|authenticate/.test(text) &&
        CONFIG.loginPassword
      ) {
        bot.chat(`/login ${CONFIG.loginPassword}`);
      } else if (
        /\/register|not registered|please register/.test(text) &&
        CONFIG.registerPassword
      ) {
        bot.chat(
          `/register ${CONFIG.registerPassword} ${CONFIG.registerPassword}`
        );
      }
    });

    bot.on('kicked', reason => {
      log(`Kicked: ${JSON.stringify(reason)}`);
    });

    bot.on('error', error => {
      log(`Minecraft error: ${error.message}`);
    });

    bot.on('end', () => {
      log('Connection ended.');
      bot = null;
      scheduleReconnect();
    });

  } catch (error) {
    log(`Connection error: ${error.message}`);
    bot = null;
    scheduleReconnect();
  }
  
app.get('/', (_req, res) => {
  res.status(200).send('BlastMC AFK Bot is running.');
});

app.get('/health', (_req, res) => {
  res.status(online ? 200 : 503).json({
    status: online ? 'online' : 'offline',
    username: CONFIG.username,
    server: `${CONFIG.host}:${CONFIG.port}`
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  log(`Web service listening on port ${PORT}`);
  connectBot();
});

function shutdown() {
  stopping = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  stopMovement();

  try {
    if (bot) bot.quit('Service shutting down');
  } catch (_) {}

  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
                 
}
