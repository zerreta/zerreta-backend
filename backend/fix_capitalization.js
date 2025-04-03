const mongoose = require('mongoose');
const Student = require('./models/Student');

// Get username from command line
const username = process.argv[2];

if (!username) {
  console.error('Please provide a username:');
  console.error('usage: node fix_capitalization.js <username>');
  console.error('example: node fix_capitalization.js student1');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/student-auth')
  .then(() => {
    console.log('Connected to MongoDB successfully');
    fixStudentProfile();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function fixStudentProfile() {
  try {
    console.log(`Searching for student with username: ${username}`);
    
    // Find the student by username
    const student = await Student.findOne({ username });
    if (!student) {
      console.error('Student not found');
      process.exit(1);
    }
    
    console.log(`Found student: ${student.name}`);
    console.log('Original subjects:', JSON.stringify(student.subjects, null, 2));
    
    // Check subjects
    if (!student.subjects) {
      console.log('No subjects found to fix');
      process.exit(0);
    }
    
    // Add capitalized versions of all subject keys
    const subjectKeys = Object.keys(student.subjects);
    const updatedSubjects = { ...student.subjects };
    
    subjectKeys.forEach(key => {
      // Add lowercase version
      const lowerKey = key.toLowerCase();
      if (lowerKey !== key && !updatedSubjects[lowerKey]) {
        updatedSubjects[lowerKey] = { ...student.subjects[key] };
        console.log(`Added lowercase version: ${lowerKey}`);
      }
      
      // Add capitalized version
      const capitalizedKey = lowerKey.charAt(0).toUpperCase() + lowerKey.slice(1);
      if (capitalizedKey !== key && !updatedSubjects[capitalizedKey]) {
        updatedSubjects[capitalizedKey] = { ...student.subjects[key] };
        console.log(`Added capitalized version: ${capitalizedKey}`);
      }
    });
    
    // Update the student record
    student.subjects = updatedSubjects;
    
    console.log('Updated subjects (before save):', JSON.stringify(student.subjects, null, 2));
    
    // Save the changes
    await student.save();
    
    console.log('Profile fixed successfully');
    console.log('New subjects:', JSON.stringify(student.subjects, null, 2));
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('Error fixing profile:', error);
    process.exit(1);
  }
} 