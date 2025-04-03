const mongoose = require('mongoose');
const Student = require('./models/Student');

// Get username from command line
const username = process.argv[2];

if (!username) {
  console.error('Please provide a username:');
  console.error('usage: node check_profile.js <username>');
  console.error('example: node check_profile.js student1');
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/student-auth')
  .then(() => {
    console.log('Connected to MongoDB successfully');
    checkStudentProfile();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function checkStudentProfile() {
  try {
    console.log(`Searching for student with username: ${username}`);
    
    // Find the student by username
    const student = await Student.findOne({ username });
    if (!student) {
      console.error('Student not found');
      process.exit(1);
    }
    
    console.log(`Found student: ${student.name}`);
    console.log('Student ID:', student._id);
    console.log('Username:', student.username);
    console.log('Institution:', student.institution);
    console.log('\nSubjects:');
    
    // Check subjects
    if (!student.subjects) {
      console.log('No subjects found');
    } else {
      // Find all subject keys (including capitalized ones)
      const subjectKeys = Object.keys(student.subjects);
      
      console.log('Subject keys in profile:', subjectKeys);
      
      // Display all subjects with levels
      subjectKeys.forEach(key => {
        const subject = student.subjects[key];
        console.log(`${key}: Level ${subject.level}, Stage ${subject.stage}`);
      });
      
      // Check common subject variations
      const commonSubjects = ['physics', 'chemistry', 'botany', 'zoology'];
      
      console.log('\nChecking standard subjects:');
      commonSubjects.forEach(subject => {
        // Check lowercase
        if (student.subjects[subject]) {
          console.log(`${subject}: Level ${student.subjects[subject].level}, Stage ${student.subjects[subject].stage}`);
        } else {
          console.log(`${subject}: Not found`);
        }
        
        // Check capitalized
        const capSubject = subject.charAt(0).toUpperCase() + subject.slice(1);
        if (student.subjects[capSubject]) {
          console.log(`${capSubject}: Level ${student.subjects[capSubject].level}, Stage ${student.subjects[capSubject].stage}`);
        } else {
          console.log(`${capSubject}: Not found`);
        }
      });
    }
    
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
    
    process.exit(0);
  } catch (error) {
    console.error('Error checking profile:', error);
    process.exit(1);
  }
} 