const { MongoClient } = require('mongodb');

// Get username from command line
const username = process.argv[2];
const url = 'mongodb://localhost:27017';
const dbName = 'student-auth';

if (!username) {
  console.error('Please provide a username:');
  console.error('usage: node direct_check.js <username>');
  process.exit(1);
}

async function checkStudentProfile() {
  let client;
  
  try {
    // Connect to MongoDB directly
    client = new MongoClient(url);
    await client.connect();
    console.log('Connected to MongoDB successfully');
    
    const db = client.db(dbName);
    const studentsCollection = db.collection('students');
    
    // Find the student by username
    const student = await studentsCollection.findOne({ username });
    if (!student) {
      console.error('Student not found');
      return;
    }
    
    console.log(`Found student: ${student.name}`);
    console.log('Student ID:', student._id);
    console.log('Username:', student.username);
    console.log('Institution:', student.institution);
    
    // Check subjects
    if (!student.subjects) {
      console.log('No subjects found');
    } else {
      console.log('\nAll Subject Keys in Database:');
      const subjectKeys = Object.keys(student.subjects);
      console.log(JSON.stringify(subjectKeys, null, 2));
      
      console.log('\nDetailed Subjects Data:');
      console.log(JSON.stringify(student.subjects, null, 2));
    }
    
  } catch (error) {
    console.error('Error checking profile:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\nDisconnected from MongoDB');
    }
  }
}

checkStudentProfile().catch(console.error); 