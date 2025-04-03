const { MongoClient } = require('mongodb');

// Get username from command line
const username = process.argv[2];
const url = 'mongodb://localhost:27017';
const dbName = 'student-auth';

if (!username) {
  console.error('Please provide a username:');
  console.error('usage: node mongo_direct_update.js <username>');
  process.exit(1);
}

async function updateStudentDirectly() {
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
    console.log('Current subjects:', student.subjects);
    
    // Create a full update with both lowercase and capitalized subjects
    const updatedSubjects = {
      ...student.subjects,
      Physics: { level: student.subjects.physics.level, stage: student.subjects.physics.stage },
      Chemistry: { level: student.subjects.chemistry.level, stage: student.subjects.chemistry.stage },
      Botany: { level: student.subjects.botany.level, stage: student.subjects.botany.stage },
      Zoology: { level: student.subjects.zoology.level, stage: student.subjects.zoology.stage }
    };
    
    // Update the student document with raw MongoDB update
    const result = await studentsCollection.updateOne(
      { _id: student._id },
      { $set: { subjects: updatedSubjects } }
    );
    
    console.log(`Update result: ${result.modifiedCount} document modified`);
    
    // Check if update was successful
    if (result.modifiedCount === 1) {
      console.log('Student updated successfully');
      // Get the updated document
      const updatedStudent = await studentsCollection.findOne({ _id: student._id });
      console.log('New subjects:', updatedStudent.subjects);
    } else {
      console.log('No changes were made');
    }
    
  } catch (error) {
    console.error('Error updating student:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('Disconnected from MongoDB');
    }
  }
}

updateStudentDirectly().catch(console.error); 