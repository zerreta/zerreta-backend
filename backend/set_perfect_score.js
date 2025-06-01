const mongoose = require('mongoose');

// Get MongoDB URI from environment or use the default
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/neet';

// Define the schemas to access the collections
const testHistorySchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  score: { type: Number, required: true },
  // Include other fields as needed
});

const TestHistory = mongoose.model('TestHistory', testHistorySchema);

async function setPerfectScore() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    
    console.log('Connected to MongoDB. Finding test records...');
    
    // Find the first test history record
    const testHistory = await TestHistory.findOne().sort({ date: -1 });
    
    if (!testHistory) {
      console.log('No test history records found.');
      return;
    }
    
    console.log(`Found test record with ID: ${testHistory._id}`);
    console.log(`Current score: ${testHistory.score}`);
    
    // Update to 100% score
    testHistory.score = 100;
    await testHistory.save();
    
    console.log('Updated test history record with a perfect 100% score!');
    
    // Verify the update
    const updatedTest = await TestHistory.findById(testHistory._id);
    console.log(`Verified new score: ${updatedTest.score}`);
    
  } catch (error) {
    console.error('Error setting perfect score:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
}

// Run the function
setPerfectScore().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 