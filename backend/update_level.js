const mongoose = require('mongoose');
const Student = require('./models/Student');

// Get username from command line
const username = process.argv[2];
const subject = process.argv[3] || 'botany';
const newLevel = process.argv[4] || '2';
const newStage = process.argv[5] || '1';

if (!username) {
  console.error('Please provide a username:');
  console.error('usage: node update_level.js <username> [subject] [level] [stage]');
  console.error('example: node update_level.js student1 botany 2 1');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/student-auth')
  .then(() => {
    console.log('Connected to MongoDB successfully');
    updateStudentLevel();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function updateStudentLevel() {
  try {
    console.log(`Searching for student with username: ${username}`);
    
    // Find the student by username
    const student = await Student.findOne({ username });
    if (!student) {
      console.error('Student not found');
      process.exit(1);
    }
    
    console.log(`Found student: ${student.name}`);
    console.log('Current subjects:', student.subjects);
    
    // Normalize the subject name
    const normalizedSubject = subject.toLowerCase();
    const capitalizedSubject = normalizedSubject.charAt(0).toUpperCase() + normalizedSubject.slice(1);
    
    // Make sure the subjects object exists
    if (!student.subjects) {
      student.subjects = {};
    }
    
    // Initialize the subject if it doesn't exist
    if (!student.subjects[normalizedSubject]) {
      student.subjects[normalizedSubject] = {
        level: '1',
        stage: '1'
      };
    }
    
    // Update the level and stage
    student.subjects[normalizedSubject] = {
      level: newLevel,
      stage: newStage
    };
    
    // Update the capitalized version too
    student.subjects[capitalizedSubject] = {
      level: newLevel,
      stage: newStage
    };
    
    console.log('Updated subjects (before save):', student.subjects);
    
    // Save the changes
    await student.save();
    
    console.log('Level updated successfully');
    console.log('New subjects:', student.subjects);
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating level:', error);
    process.exit(1);
  }
} 