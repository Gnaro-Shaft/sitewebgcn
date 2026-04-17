const mongoose = require('mongoose');

let botConnection = null;

const connectBotDB = async () => {
  if (botConnection) return botConnection;

  try {
    botConnection = await mongoose.createConnection(process.env.BOT_MONGODB_URI);
    console.log(`Bot MongoDB connected: ${botConnection.host}`);
    return botConnection;
  } catch (error) {
    console.error(`Bot MongoDB connection error: ${error.message}`);
    return null;
  }
};

const getBotConnection = () => botConnection;

module.exports = { connectBotDB, getBotConnection };
