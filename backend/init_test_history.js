const mongoose = require('mongoose');

// Get MongoDB URI from environment or use the default
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/neet';

// Define the schemas
const testHistorySchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  stage: { type: String, default: '1' },
  level: { type: String, default: '1' },
  score: { type: Number, required: true },
  passedLevel: { type: Boolean, default: false },
  totalTime: { type: Number, required: true },
  questions: [{
    text: String,
    selectedOption: String,
    correctOption: String,
    isCorrect: Boolean,
    timeSpent: Number,
    allocatedTime: Number,
    explanation: String,
    topicNumber: String,
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    attemptCount: { type: Number, default: 1 },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' }
  }],
  date: { type: Date, default: Date.now },
  testMode: { type: String, enum: ['practice', 'assessment'], required: true },
  topicNumber: { type: String },
  topics: [{ type: String }],
  deviceInfo: {
    browser: String,
    platform: String,
    screenSize: String
  },
  timingDetails: {
    startTime: { type: Date },
    endTime: { type: Date },
    pauseDuration: { type: Number, default: 0 },
    questionTransitionTimes: [Number]
  },
  performanceMetrics: {
    correctAnswers: { type: Number, default: 0 },
    incorrectAnswers: { type: Number, default: 0 },
    unanswered: { type: Number, default: 0 },
    topicWisePerformance: mongoose.Schema.Types.Mixed,
    averageTimePerQuestion: { type: Number, default: 0 }
  },
  userActions: {
    optionChanges: { type: Number, default: 0 },
    reviewMarked: [Number]
  },
  isCompleted: { type: Boolean, default: true },
  improvement: {
    previousBestScore: { type: Number, default: 0 },
    scoreImprovement: { type: Number, default: 0 },
    timeImprovement: { type: Number, default: 0 }
  }
});

// Define student schema
const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  studentId: { type: String, required: true, unique: true },
  institution: { type: String, default: 'Default Institution' },
  column1: { type: String, default: '' },
  column2: { type: String, default: '' },
  column3: { type: String, default: '' },
  column4: { type: String, default: '' },
  column5: { type: String, default: '' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

// Define user schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'student'], default: 'student' }
});

// Register the models
const TestHistory = mongoose.model('TestHistory', testHistorySchema);
const Student = mongoose.model('Student', studentSchema);
const User = mongoose.model('User', userSchema);

async function initializeTestHistory() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    
    console.log('Connected to MongoDB. Checking for existing data...');
    
    // Check if we already have test history data
    const testHistoryCount = await TestHistory.countDocuments();
    if (testHistoryCount > 0) {
      console.log(`Found ${testHistoryCount} existing test history records. Skipping initialization.`);
      return;
    }
    
    // Check if we have students in the database
    const students = await Student.find();
    if (students.length === 0) {
      console.log('No students found in database. Creating test students first...');
      // Create test students
      await createTestStudents();
    } else {
      console.log(`Found ${students.length} existing students.`);
    }
    
    // Get all students with their user IDs
    const studentsWithUsers = await Student.find();
    
    if (studentsWithUsers.length === 0) {
      console.error('No students found after initialization. Cannot create test history.');
      return;
    }
    
    console.log('Creating sample test history data...');
    
    // Create sample test history for each student
    for (const student of studentsWithUsers) {
      // Find associated user
      const user = await User.findOne({ username: student.username });
      
      if (!user) {
        console.warn(`No user found for student ${student.name}. Skipping.`);
        continue;
      }
      
      console.log(`Creating test history for student: ${student.name}`);
      
      // Create multiple test history entries for this student
      await createStudentTestHistory(user._id, student.name);
    }
    
    console.log('Test history initialization complete!');
  } catch (error) {
    console.error('Error initializing test history:', error);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
  }
}

async function createTestStudents() {
  // Create test students with associated users
  const testStudents = [
    { name: 'John Smith', username: 'john', studentId: 'ST001', institution: 'ABC College' },
    { name: 'Jane Doe', username: 'jane', studentId: 'ST002', institution: 'XYZ University' },
    { name: 'Bob Johnson', username: 'bob', studentId: 'ST003', institution: 'ABC College' }
  ];
  
  for (const studentData of testStudents) {
    // Create user
    const user = new User({
      username: studentData.username,
      password: '$2b$10$XNxaDARBh3yLYMhseuVW9.MmTYYEP7e0FQWpgLz64pYrUZrpjLVMi', // 'password123'
      role: 'student'
    });
    
    await user.save();
    console.log(`Created user: ${user.username}`);
    
    // Create student
    const student = new Student({
      ...studentData,
      user: user._id
    });
    
    await student.save();
    console.log(`Created student: ${student.name}`);
  }
}

async function createStudentTestHistory(userId, studentName) {
  const subjects = ['physics', 'chemistry', 'biology', 'zoology', 'botany'];
  const testModes = ['practice', 'assessment'];
  
  // Create between 3-8 test history records for this student
  const numTests = Math.floor(Math.random() * 6) + 3;
  
  for (let i = 0; i < numTests; i++) {
    const subject = subjects[Math.floor(Math.random() * subjects.length)];
    const testMode = testModes[Math.floor(Math.random() * testModes.length)];
    const score = Math.floor(Math.random() * 101); // 0-100
    const totalTime = Math.floor(Math.random() * 60) + 10; // 10-70 minutes
    
    // Generate between 5-20 questions
    const numQuestions = Math.floor(Math.random() * 16) + 5;
    const questions = [];
    
    let correctAnswers = 0;
    
    for (let j = 0; j < numQuestions; j++) {
      const isCorrect = Math.random() > 0.4; // 60% chance of correct answer
      if (isCorrect) correctAnswers++;
      
      const timeSpent = Math.floor(Math.random() * 120) + 10; // 10-130 seconds per question
      
      questions.push({
        text: `Sample question ${j+1} for ${subject} test`,
        selectedOption: isCorrect ? 'A' : 'B',
        correctOption: 'A',
        isCorrect,
        timeSpent,
        allocatedTime: 120,
        explanation: `This is an explanation for question ${j+1}. It shows the correct approach to solving this problem.`,
        difficulty: ['easy', 'medium', 'hard'][Math.floor(Math.random() * 3)],
        attemptCount: 1
      });
    }
    
    // Create test date (somewhere in the last 30 days)
    const testDate = new Date();
    testDate.setDate(testDate.getDate() - Math.floor(Math.random() * 30));
    
    // Create test history object
    const testHistory = new TestHistory({
      studentId: userId,
      subject,
      score,
      totalTime,
      questions,
      date: testDate,
      testMode,
      topicNumber: testMode === 'practice' ? Math.floor(Math.random() * 10) + 1 : null,
      topics: testMode === 'assessment' ? ['Topic 1', 'Topic 2', 'Topic 3'].slice(0, Math.floor(Math.random() * 3) + 1) : [],
      deviceInfo: {
        browser: 'Chrome',
        platform: 'Windows',
        screenSize: '1920x1080'
      },
      performanceMetrics: {
        correctAnswers,
        incorrectAnswers: numQuestions - correctAnswers,
        unanswered: 0,
        averageTimePerQuestion: Math.floor(totalTime * 60 / numQuestions)
      },
      isCompleted: true
    });
    
    await testHistory.save();
    console.log(`Created test history #${i+1} for ${studentName}: ${subject} (${score}%)`);
  }
}

// Run the initialization
initializeTestHistory().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 