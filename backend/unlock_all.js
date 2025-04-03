const { MongoClient } = require('mongodb');

// Username from command line
const username = process.argv[2] || '22';
const url = 'mongodb://localhost:27017';
const dbName = 'student-auth';

async function unlockAllLevels() {
  let client;
  
  try {
    console.log(`Unlocking all levels for user: ${username}`);
    
    // Connect directly to MongoDB
    client = new MongoClient(url);
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(dbName);
    const students = db.collection('students');
    
    // Find the student
    const student = await students.findOne({ username });
    if (!student) {
      console.error(`Student with username ${username} not found`);
      return;
    }
    
    console.log('Found student:', student.name);
    console.log('Current subjects:', student.subjects);
    
    // Update all subjects to have next levels unlocked
    const updatedSubjects = {
      // Physics
      physics: { level: '4', stage: '1' },
      Physics: { level: '4', stage: '1' },
      // Chemistry
      chemistry: { level: '4', stage: '1' },
      Chemistry: { level: '4', stage: '1' },
      // Botany
      botany: { level: '4', stage: '1' },
      Botany: { level: '4', stage: '1' },
      // Zoology
      zoology: { level: '4', stage: '1' },
      Zoology: { level: '4', stage: '1' }
    };
    
    // Update the student document
    const result = await students.updateOne(
      { _id: student._id },
      { $set: { subjects: updatedSubjects } }
    );
    
    if (result.modifiedCount === 1) {
      console.log('SUCCESS: All levels successfully unlocked!');
      
      // Verify the update
      const updated = await students.findOne({ _id: student._id });
      console.log('New subject levels:', updated.subjects);
    } else {
      console.log('No changes were made');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('Disconnected from MongoDB');
    }
  }
}

unlockAllLevels().catch(console.error); 