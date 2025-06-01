const mongoose = require('mongoose');

// Get MongoDB URI from environment or use the default
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/neet';

async function checkConnection() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Connected to MongoDB!');
    console.log('Connection details:');
    console.log(`  - Host: ${mongoose.connection.host}`);
    console.log(`  - Database: ${mongoose.connection.name}`);
    
    // Check if test history collection exists
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log('Collections:', collectionNames);
    
    if (collectionNames.includes('testhistories')) {
      const count = await mongoose.connection.db.collection('testhistories').countDocuments();
      console.log(`TestHistory collection exists with ${count} documents`);
    } else {
      console.log('⚠️ TestHistory collection does not exist');
    }
    
    // Close the connection
    await mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

// Run the check
checkConnection(); 