const mongoose = require('mongoose');

// Get MongoDB URI from environment or use the default
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/neet';

// Define the schemas to access the collections
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, required: true }
});

const studentSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  name: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true }
});

const testHistorySchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subject: { type: String, required: true },
  score: { type: Number, required: true }
});

const User = mongoose.model('User', userSchema);
const Student = mongoose.model('Student', studentSchema);
const TestHistory = mongoose.model('TestHistory', testHistorySchema);

async function fixTestHistoryData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    
    console.log('Connected to MongoDB. Finding test history records...');
    
    // Get all test history records
    const testHistories = await TestHistory.find();
    console.log(`Found ${testHistories.length} test history records`);
    
    // Get all students
    const students = await Student.find();
    console.log(`Found ${students.length} students`);
    
    // Fix each test history record
    let updatedCount = 0;
    
    for (const test of testHistories) {
      // Check if the studentId is a User ID (old format)
      const user = await User.findById(test.studentId);
      
      if (user) {
        // Find the student with matching username
        const student = students.find(s => s.username === user.username);
        
        if (student) {
          console.log(`Updating test ID ${test._id} - Changing studentId from User ${user.username} to Student ${student.name}`);
          
          // Update the reference
          test.studentId = student._id;
          
          // Ensure score is set correctly
          if (typeof test.score !== 'number' || isNaN(test.score)) {
            console.log(`  Fixing invalid score value: ${test.score}`);
            
            // Calculate score based on correct answers if possible
            if (test.questions && test.questions.length > 0) {
              const correctAnswers = test.questions.filter(q => q.isCorrect).length;
              const totalQuestions = test.questions.length;
              const calculatedScore = Math.round((correctAnswers / totalQuestions) * 100);
              
              test.score = calculatedScore;
              console.log(`  Set score to ${calculatedScore}% based on ${correctAnswers}/${totalQuestions} correct answers`);
            } else {
              // Default to a sample score if we can't calculate
              test.score = 75;
              console.log(`  Set default score to 75%`);
            }
          }
          
          await test.save();
          updatedCount++;
        } else {
          console.log(`WARNING: No student found for user ${user.username}`);
        }
      } else {
        // Check if it's already a valid student reference
        const student = await Student.findById(test.studentId);
        if (student) {
          console.log(`Test ID ${test._id} already has valid student reference: ${student.name}`);
          
          // Just ensure score is correctly set
          if (typeof test.score !== 'number' || isNaN(test.score)) {
            console.log(`  Fixing invalid score value: ${test.score}`);
            
            // Calculate score or use default
            if (test.questions && test.questions.length > 0) {
              const correctAnswers = test.questions.filter(q => q.isCorrect).length;
              const totalQuestions = test.questions.length;
              const calculatedScore = Math.round((correctAnswers / totalQuestions) * 100);
              
              test.score = calculatedScore;
              console.log(`  Set score to ${calculatedScore}% based on ${correctAnswers}/${totalQuestions} correct answers`);
            } else {
              test.score = 75;
              console.log(`  Set default score to 75%`);
            }
            
            await test.save();
            updatedCount++;
          }
        } else {
          console.log(`ERROR: Test ID ${test._id} has invalid studentId that's neither a User nor a Student`);
        }
      }
    }
    
    console.log(`Updated ${updatedCount} test history records`);
    
  } catch (error) {
    console.error('Error fixing test history data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
}

// Run the function
fixTestHistoryData().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 