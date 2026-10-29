const mongoose = require('mongoose');

let mongoConnected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.trim() === '') {
    console.log('[Database] MONGODB_URI not provided. Running in resilient in-memory mode.');
    mongoConnected = false;
    return false;
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 4000,
    });
    mongoConnected = true;
    console.log('[Database] Connected successfully to MongoDB.');
    return true;
  } catch (error) {
    mongoConnected = false;
    console.warn(`[Database] MongoDB connection failed (${error.message}). Continuing in in-memory mode.`);
    return false;
  }
}

function isMongoConnected() {
  return mongoConnected && mongoose.connection.readyState === 1;
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    mongoConnected = false;
  }
}

module.exports = {
  connectDB,
  isMongoConnected,
  disconnectDB,
};
