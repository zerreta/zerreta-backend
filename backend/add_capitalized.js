const mongoose = require('mongoose');
const Student = require('./models/Student');

// Get username from command line
const username = process.argv[2];

if (!username) {
  console.error('Please provide a username:');
  console.error('usage: node add_capitalized.js <username>');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/student-auth')
  .then(() => {
    console.log('Connected to MongoDB successfully');
    updateProfile();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function updateProfile() {
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
    
    // Add capitalized versions
    if (student.subjects.physics) {
      student.subjects.Physics = {
        level: student.subjects.physics.level,
        stage: student.subjects.physics.stage
      };
    }
    
    if (student.subjects.chemistry) {
      student.subjects.Chemistry = {
        level: student.subjects.chemistry.level,
        stage: student.subjects.chemistry.stage
      };
    }
    
    if (student.subjects.botany) {
      student.subjects.Botany = {
        level: student.subjects.botany.level,
        stage: student.subjects.botany.stage
      };
    }
    
    if (student.subjects.zoology) {
      student.subjects.Zoology = {
        level: student.subjects.zoology.level,
        stage: student.subjects.zoology.stage
      };
    }
    
    // Save the updated profile
    await student.save();
    
    console.log('Profile updated successfully');
    console.log('New subjects:', student.subjects);
    
    // Clean up and exit
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating profile:', error);
    process.exit(1);
  }
} 