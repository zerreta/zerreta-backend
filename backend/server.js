const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
// Configure CORS with more permissive settings for debugging
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create a unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'question-image-' + uniqueSuffix + ext);
  }
});

// Filter images by type
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB file size limit
  }
});

// MongoDB Connection
console.log('Connecting to MongoDB...');
console.log('Using connection string:', process.env.MONGODB_URI ? 'Connection string is set' : 'Connection string is missing!');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/student-auth')
  .then(() => {
    console.log('Connected to MongoDB successfully');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
//s
// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'student'], required: true }
});

const User = mongoose.model('User', userSchema);

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'neet-admin-secure-jwt-secret-key-2025';

// Create default admin user
const createAdminUser = async () => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        username: 'admin',
        password: hashedPassword,
        role: 'admin'
      });
      console.log('Admin user created successfully');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// Create a test student user
const createTestStudent = async () => {
  try {
    const studentExists = await User.findOne({ username: 'student', role: 'student' });
    if (!studentExists) {
      const hashedPassword = await bcrypt.hash('student123', 10);
      await User.create({
        username: 'student',
        password: hashedPassword,
        role: 'student'
      });
      console.log('Test student user created successfully');
    }
  } catch (error) {
    console.error('Error creating test student user:', error);
  }
};

createAdminUser();
createTestStudent();

// Import Student model
const Student = require('./models/Student');
// Import Question model
const Question = require('./models/Question');

// Test History Schema
const testHistorySchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  stage: { type: String, required: true },
  level: { type: String, required: true },
  score: { type: Number, required: true },
  passedLevel: { type: Boolean, default: false },
  totalTime: { type: Number, required: true }, // in minutes
  questions: [{
    text: String,
    selectedOption: String,
    correctOption: String,
    isCorrect: Boolean,
    timeSpent: Number,
    allocatedTime: Number,
    explanation: String
  }],
  date: { type: Date, default: Date.now }
});

const TestHistory = mongoose.model('TestHistory', testHistorySchema);

// Middleware to authenticate token
const authenticateToken = (req, res, next) => {
  console.log('Authenticating token...');
  const authHeader = req.headers['authorization'];
  console.log('Authorization header:', authHeader);
  
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ message: 'Access denied' });
  }

  try {
    console.log('Verifying token...');
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token decoded successfully:', decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    res.status(403).json({ message: 'Invalid token' });
  }
};

// Login Route
app.post('/login', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    console.log('Login attempt:', { username, role });
    
    const user = await User.findOne({ username, role });

    if (!user) {
      console.log('User not found:', { username, role });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('User found, verifying password');
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.log('Invalid password for user:', username);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('Password verified, generating token');
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('Login successful for user:', username);
    res.json({ token, role: user.role });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Student Management Routes (Admin only)

// Create a new student
app.post('/admin/students', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { studentId, name, username, password, subjects, institution, column1, column2, column3, column4, column5 } = req.body;
    
    // Check if student ID already exists
    const existingStudentId = await Student.findOne({ studentId });
    if (existingStudentId) {
      return res.status(400).json({ message: 'Student ID already exists' });
    }

    // Check if username already exists
    const existingUsername = await Student.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Create new student
    const newStudent = new Student({
      studentId,
      name,
      username,
      password,
      institution: institution || 'Default Institution',
      subjects: subjects || {
        physics: { level: '1', stage: '1' },
        chemistry: { level: '1', stage: '1' },
        botany: { level: '1', stage: '1' },
        zoology: { level: '1', stage: '1' }
      },
      column1,
      column2,
      column3,
      column4,
      column5
    });

    await newStudent.save();

    // Also create a user account for the student
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      username,
      password: hashedPassword,
      role: 'student'
    });

    res.status(201).json({ message: 'Student added successfully', student: newStudent });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all students with detailed information
app.get('/admin/students', authenticateToken, async (req, res) => {
  console.log('GET /admin/students endpoint called');
  try {
    if (req.user.role !== 'admin') {
      console.log('User is not admin:', req.user);
      return res.status(403).json({ message: 'Not authorized' });
    }

    console.log('Fetching students from database...');
    const students = await Student.find();
    console.log('Students found:', students.length);
    res.json(students);
  } catch (error) {
    console.error('Error in GET /admin/students:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a specific student
app.get('/admin/students/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(student);
  } catch (error) {
    console.error('Error getting student:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update a student
app.put('/admin/students/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { studentId, name, username, password, subjects, institution, column1, column2, column3, column4, column5 } = req.body;
    
    // Find student by ID
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Update student fields
    student.studentId = studentId || student.studentId;
    student.name = name || student.name;
    student.username = username || student.username;
    student.password = password || student.password;
    student.institution = institution || student.institution;
    student.subjects = subjects || student.subjects;
    student.column1 = column1 !== undefined ? column1 : student.column1;
    student.column2 = column2 !== undefined ? column2 : student.column2;
    student.column3 = column3 !== undefined ? column3 : student.column3;
    student.column4 = column4 !== undefined ? column4 : student.column4;
    student.column5 = column5 !== undefined ? column5 : student.column5;

    await student.save();

    // If password is changed, update the user account as well
    if (password !== student.password) {
      const user = await User.findOne({ username: student.username });
      if (user) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.findByIdAndUpdate(user._id, { 
          username, 
          password: hashedPassword 
        });
      }
    }

    res.json({ message: 'Student updated successfully', student: student });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a student
app.delete('/admin/students/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check if student exists
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Delete student
    await Student.findByIdAndDelete(req.params.id);

    // Also delete the user account
    const user = await User.findOne({ username: student.username });
    if (user) {
      await User.findByIdAndDelete(user._id);
    }

    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Student Routes (for student users)

// Get current student data
app.get('/student/profile', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Find the user to get the username
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the student data using the username
    const student = await Student.findOne({ username: user.username });
    if (!student) {
      return res.status(404).json({ message: 'Student data not found' });
    }

    res.json(student);
  } catch (error) {
    console.error('Error getting student profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Question Management Routes

// Create a new question (Admin only)
app.post('/admin/questions', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { subject, stage, level, topic, questionText, options, correctOption, explanation, difficulty, imageUrl, timeAllocation } = req.body;

    console.log('Creating question with data:', { 
      subject, stage, level, topic, questionText, 
      options: options ? options.length : 'none', 
      correctOption, 
      imageUrl: imageUrl || 'none'
    });

    if (!subject || !stage || !level || !questionText || !options || correctOption === undefined) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    // Create new question
    const newQuestion = new Question({
      subject,
      stage,
      level,
      topic: topic || '',
      questionText,
      options,
      correctOption,
      explanation: explanation || '',
      difficulty: difficulty || 'medium',
      imageUrl: imageUrl || '',
      timeAllocation: timeAllocation || 60
    });

    await newQuestion.save();
    console.log('Question created successfully with ID:', newQuestion._id);
    console.log('Image URL saved:', newQuestion.imageUrl);
    
    res.status(201).json({ message: 'Question created successfully', question: newQuestion });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk upload questions (Admin only)
app.post('/admin/questions/bulk', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { questions } = req.body;
    
    console.log('Received bulk upload request with', questions ? questions.length : 0, 'questions');
    
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'Valid questions array must be provided' });
    }
    
    // Log the first question for debugging
    if (questions.length > 0) {
      console.log('Sample question:', JSON.stringify(questions[0], null, 2));
    }
    
    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      if (!question.subject || !question.stage || !question.level || 
          !question.questionText || !question.options || question.correctOption === undefined) {
        console.error(`Validation failed for question ${i}:`, JSON.stringify(question, null, 2));
        return res.status(400).json({ 
          message: `Question at index ${i} is missing required fields: ${
            [
              !question.subject ? 'subject' : null,
              !question.stage ? 'stage' : null,
              !question.level ? 'level' : null,
              !question.questionText ? 'questionText' : null,
              !question.options ? 'options' : null,
              question.correctOption === undefined ? 'correctOption' : null
            ].filter(Boolean).join(', ')
          }` 
        });
      }
      
      // Ensure topic is set (default to empty string if not provided)
      if (!question.topic) {
        question.topic = '';
      }
      
      // Ensure timeAllocation is a number
      if (question.timeAllocation) {
        question.timeAllocation = Number(question.timeAllocation);
      } else {
        question.timeAllocation = 60; // Default value
      }
      
      // Fix difficulty values - convert "moderate" to "medium"
      if (question.difficulty === 'moderate') {
        console.log(`Converting difficulty from 'moderate' to 'medium' for question ${i}`);
        question.difficulty = 'medium';
      }
      
      // Sanitize options to handle Unicode characters if needed
      if (Array.isArray(question.options)) {
        for (let j = 0; j < question.options.length; j++) {
          // Keep the Unicode characters but ensure they're valid for MongoDB
          // This preserves the characters but makes them safer for storage
          if (typeof question.options[j] === 'string') {
            question.options[j] = question.options[j].normalize('NFC');
          }
        }
      }
    }
    
    // Apply additional sanitization to handle special characters
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      // Normalize all text fields to handle Unicode properly
      if (question.questionText) {
        question.questionText = question.questionText.normalize('NFC');
      }
      
      if (question.explanation) {
        question.explanation = question.explanation.normalize('NFC');
      }
      
      if (question.topic) {
        question.topic = question.topic.normalize('NFC');
      }
    }
    
    console.log('All questions validated and sanitized, proceeding with insertion');
    
    try {
      // First try to insert each question individually to identify problematic ones
      const successfulQuestions = [];
      const failedQuestions = [];
      
      for (let i = 0; i < questions.length; i++) {
        try {
          const question = questions[i];
          const newQuestion = new Question(question);
          await newQuestion.save();
          successfulQuestions.push(question);
        } catch (err) {
          console.error(`Error saving question at index ${i}:`, err.message);
          failedQuestions.push({
            index: i,
            error: err.message,
            question: questions[i]
          });
        }
      }
      
      if (failedQuestions.length > 0) {
        console.error(`Failed to save ${failedQuestions.length} questions. First failure:`, 
          JSON.stringify(failedQuestions[0], null, 2));
        
        return res.status(500).json({
          message: `Partially successful upload. Saved ${successfulQuestions.length} questions, failed to save ${failedQuestions.length} questions.`,
          failedCount: failedQuestions.length,
          successCount: successfulQuestions.length,
          firstError: failedQuestions[0].error,
          failedQuestionIndex: failedQuestions[0].index
        });
      }
      
      console.log(`Successfully inserted ${successfulQuestions.length} questions`);
      res.status(201).json({ 
        message: `${successfulQuestions.length} questions uploaded successfully`, 
        count: successfulQuestions.length 
      });
    } catch (dbError) {
      console.error('Database error during question insertion:', dbError);
      return res.status(500).json({ 
        message: 'Database error during insertion', 
        error: dbError.message,
        code: dbError.code
      });
    }
  } catch (error) {
    console.error('Error handling bulk upload:', error);
    res.status(500).json({ 
      message: 'Server error processing bulk upload',
      error: error.message
    });
  }
});

// Get all questions (Admin only)
app.get('/admin/questions', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    // Get filter parameters
    const { subject, stage, level } = req.query;
    const filter = {};
    
    if (subject) filter.subject = subject;
    if (stage) filter.stage = stage;
    if (level) filter.level = level;
    
    const questions = await Question.find(filter);
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific question by ID (Admin only)
app.get('/admin/questions/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const question = await Question.findById(req.params.id);
    
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    res.json(question);
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a question (Admin only)
app.put('/admin/questions/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { subject, stage, level, topic, questionText, options, correctOption, explanation, difficulty, imageUrl, timeAllocation } = req.body;

    console.log('Updating question with data:', { 
      id: req.params.id,
      subject, stage, level, topic, questionText, 
      options: options ? options.length : 'none', 
      correctOption, 
      imageUrl: imageUrl || 'none'
    });

    const updatedQuestion = await Question.findByIdAndUpdate(
      req.params.id,
      { 
        subject,
        stage,
        level,
        topic: topic || '',
        questionText,
        options,
        correctOption,
        explanation: explanation || '',
        difficulty: difficulty || 'medium',
        imageUrl: imageUrl || '',
        timeAllocation: timeAllocation || 60
      },
      { new: true }
    );

    if (!updatedQuestion) {
      return res.status(404).json({ message: 'Question not found' });
    }

    console.log('Question updated successfully with ID:', updatedQuestion._id);
    console.log('Image URL updated:', updatedQuestion.imageUrl);

    res.json({ message: 'Question updated successfully', question: updatedQuestion });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a question (Admin only)
app.delete('/admin/questions/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }
    
    const deletedQuestion = await Question.findByIdAndDelete(req.params.id);
    
    if (!deletedQuestion) {
      return res.status(404).json({ message: 'Question not found' });
    }
    
    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get questions for a test (Student)
app.get('/student/test', authenticateToken, async (req, res) => {
  try {
    const { subject, stage, level } = req.query;
    
    if (!subject || !stage || !level) {
      return res.status(400).json({ message: 'Subject, stage, and level are required' });
    }
    
    // Find questions matching the criteria
    const questions = await Question.find({ 
      subject: subject,
      stage: stage,
      level: level
    });
    
    // Return questions with all necessary fields for the test
    const testQuestions = questions.map(q => {
      // Log the image URL for debugging
      console.log(`Question ${q._id} image URL:`, q.imageUrl);
      
      return {
        id: q._id,
        questionText: q.questionText,
        optionA: q.options[0] || '',
        optionB: q.options[1] || '',
        optionC: q.options[2] || '',
        optionD: q.options[3] || '',
        // Include the full options array as well for debugging
        options: q.options || [],
        subject: q.subject,
        stage: q.stage,
        level: q.level,
        difficulty: q.difficulty,
        imageUrl: q.imageUrl || '',
        correctOption: typeof q.correctOption === 'number' ? 
                    ['A', 'B', 'C', 'D'][q.correctOption] : q.correctOption || 'A'
      };
    });
    
    // Log a sample question to debug
    if (testQuestions.length > 0) {
      console.log('Sample question being sent to frontend:', JSON.stringify(testQuestions[0], null, 2));
      console.log('First question options:', {
        optionA: testQuestions[0].optionA,
        optionB: testQuestions[0].optionB,
        optionC: testQuestions[0].optionC,
        optionD: testQuestions[0].optionD,
        fullOptions: testQuestions[0].options,
        imageUrl: testQuestions[0].imageUrl // Add the imageUrl to the debug output
      });
    }
    
    res.json({ questions: testQuestions });
  } catch (error) {
    console.error('Error fetching test questions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Process test completion and save results
app.post('/student/complete-test', authenticateToken, async (req, res) => {
  try {
    const { 
      testId, 
      subject, 
      stage, 
      level, 
      questions, 
      score, 
      timeTaken,
      passedLevel 
    } = req.body;
    
    const studentId = req.user.id;
    
    console.log(`Saving test results for student ${studentId}, subject ${subject}, score ${score}`);
    
    // Create test history record
    const testResult = new TestHistory({
      studentId,
      subject,
      stage,
      level,
      score,
      questions,
      totalTime: Math.round(timeTaken / 60), // Convert seconds to minutes
      passedLevel: passedLevel || score >= 70, // Default passing threshold is 70%
      date: new Date()
    });
    
    await testResult.save();
    console.log('Test history saved successfully with ID:', testResult._id);
    
    // Update student level if they passed
    if (passedLevel || score >= 70) {
      try {
        const student = await Student.findById(studentId);
        
        if (!student.subjects) {
          student.subjects = {};
        }
        
        if (!student.subjects[subject]) {
          student.subjects[subject] = { stage: '1', level: '1' };
        }
        
        // Convert existing level to number, increment, then back to string
        const currentLevel = parseInt(student.subjects[subject].level);
        const currentStage = parseInt(student.subjects[subject].stage);
        
        // Only update if the completed level is the current level
        if (
          (stage === student.subjects[subject].stage && level === student.subjects[subject].level) ||
          // Or if it's a higher stage/level than current
          (parseInt(stage) > currentStage) ||
          (parseInt(stage) === currentStage && parseInt(level) > currentLevel)
        ) {
          // Check if we need to move to next stage
          if (currentLevel >= 5) {
            student.subjects[subject].stage = (currentStage + 1).toString();
            student.subjects[subject].level = '1';
          } else {
            student.subjects[subject].level = (currentLevel + 1).toString();
          }
          
          await student.save();
          console.log(`Student level updated to Stage ${student.subjects[subject].stage}, Level ${student.subjects[subject].level}`);
        }
      } catch (levelUpdateError) {
        console.error('Error updating student level:', levelUpdateError);
        // We don't want to fail the whole request if just the level update fails
      }
    }
    
    res.status(201).json({ 
      message: 'Test result saved successfully',
      testId: testResult._id 
    });
  } catch (error) {
    console.error('Error saving test history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Store test result in history
app.post('/student/test-history', authenticateToken, async (req, res) => {
  try {
    const { subject, stage, level, score, questions, totalTime, passedLevel } = req.body;
    const studentId = req.user.id;
    
    // Create new test history entry
    const testResult = new TestHistory({
      studentId,
      subject,
      stage,
      level,
      score,
      questions,
      totalTime,
      passedLevel,
      date: new Date()
    });
    
    await testResult.save();
    
    res.status(201).json({ message: 'Test result saved successfully' });
  } catch (error) {
    console.error('Error saving test history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get test history for a student
app.get('/student/test-history', authenticateToken, async (req, res) => {
  try {
    const { subject, stage, level } = req.query;
    const studentId = req.user.id;
    
    // Build query based on provided parameters
    const query = { studentId };
    
    if (subject) query.subject = subject;
    if (stage) query.stage = stage;
    if (level) query.level = level;
    
    const testHistory = await TestHistory.find(query)
      .sort({ date: -1 }) // Sort by date descending (newest first)
      .lean();
    
    // Format for easier frontend consumption
    const formattedHistory = {};
    
    testHistory.forEach(test => {
      const subjectId = test.subject;
      const levelKey = `${test.stage}-${test.level}`;
      
      if (!formattedHistory[subjectId]) {
        formattedHistory[subjectId] = {};
      }
      
      // Only keep the most recent attempt for each level
      if (!formattedHistory[subjectId][levelKey]) {
        formattedHistory[subjectId][levelKey] = {
          subjectName: getSubjectName(subjectId),
          stage: test.stage,
          level: test.level,
          date: test.date,
          score: test.score,
          passed: test.passedLevel,
          correctCount: test.questions.filter(q => q.isCorrect).length,
          totalQuestions: test.questions.length,
          totalTime: test.totalTime, // minutes
          avgTimePerQuestion: Math.round((test.totalTime * 60) / test.questions.length), // seconds
          questions: test.questions
        };
      }
    });
    
    res.json(formattedHistory);
  } catch (error) {
    console.error('Error fetching test history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all test history for a student as a raw array
app.get('/student/all-test-history', authenticateToken, async (req, res) => {
  try {
    const studentId = req.user.id;
    
    // Fetch all test history for the student
    const testHistory = await TestHistory.find({ studentId })
      .sort({ date: -1 }) // Sort by date descending (newest first)
      .lean();
    
    // Transform each test for the history table format
    const formattedTests = testHistory.map(test => {
      return {
        _id: test._id,
        subject: getSubjectName(test.subject),
        stage: test.stage,
        level: test.level,
        score: test.score,
        totalQuestions: test.questions.length,
        correctAnswers: test.questions.filter(q => q.isCorrect).length,
        timeTaken: test.totalTime * 60, // Convert minutes to seconds
        passedLevel: test.passedLevel,
        startTime: test.date,
        endTime: new Date(new Date(test.date).getTime() + test.totalTime * 60 * 1000).toISOString(),
        date: test.date
      };
    });
    
    res.json(formattedTests);
  } catch (error) {
    console.error('Error fetching all test history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to get subject name
function getSubjectName(subjectId) {
  const subjects = {
    physics: 'Physics',
    chemistry: 'Chemistry',
    botany: 'Botany',
    zoology: 'Zoology'
  };
  
  return subjects[subjectId] || subjectId;
}

// Debug route to check available users (remove in production)
app.get('/debug/users', async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }); // Exclude passwords
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Image upload endpoint for questions
app.post('/admin/upload-image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Just store the relative path to the file - this is more reliable across environments
    const imageUrl = `/uploads/${req.file.filename}`;
    console.log('Uploaded image URL:', imageUrl);
    
    // Return the full URL in the response for convenience
    const fullImageUrl = `${req.protocol}://${req.get('host')}${imageUrl}`;
    console.log('Full image URL for client:', fullImageUrl);

    res.status(200).json({ 
      message: 'Image uploaded successfully',
      imageUrl: imageUrl
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Calculate N.POINTS and update all students
app.post('/admin/update-points', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    // Get all students
    const students = await Student.find();
    let updated = 0;

    // Update each student's N.POINTS
    for (const student of students) {
      let totalPoints = 0;
      
      // Calculate points for each subject (25 points per level)
      if (student.subjects) {
        // Physics points
        if (student.subjects.physics) {
          const level = parseInt(student.subjects.physics.level) || 1;
          totalPoints += level * 25;
        }
        
        // Chemistry points
        if (student.subjects.chemistry) {
          const level = parseInt(student.subjects.chemistry.level) || 1;
          totalPoints += level * 25;
        }
        
        // Botany points
        if (student.subjects.botany) {
          const level = parseInt(student.subjects.botany.level) || 1;
          totalPoints += level * 25;
        }
        
        // Zoology points
        if (student.subjects.zoology) {
          const level = parseInt(student.subjects.zoology.level) || 1;
          totalPoints += level * 25;
        }
      }
      
      // Update student's N.POINTS if different from current value
      if (student.nPoints !== totalPoints) {
        student.nPoints = totalPoints;
        await student.save();
        updated++;
      }
    }
    
    res.json({ 
      message: `N.POINTS updated successfully for ${updated} students`,
      updatedCount: updated,
      totalStudents: students.length
    });
  } catch (error) {
    console.error('Error updating N.POINTS:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin endpoint to get leaderboard data
app.get('/admin/leaderboard', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    // Get all students with relevant fields for leaderboard
    const students = await Student.find({}, {
      studentId: 1,
      name: 1,
      nPoints: 1,
      subjects: 1
    }).sort({ nPoints: -1 }); // Sort by points descending
    
    res.json(students);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Student endpoint to get leaderboard data
app.get('/student/leaderboard', authenticateToken, async (req, res) => {
  try {
    // Get all students with relevant fields for leaderboard
    const students = await Student.find({}, {
      studentId: 1,
      name: 1,
      subjects: 1
    });
    
    // Process students to calculate N.POINTS
    const studentsWithPoints = students.map(student => {
      let totalLevelsCleared = 0;
      
      if (student.subjects) {
        const { physics, chemistry, botany, zoology } = student.subjects;
        
        // Convert level strings to numbers and subtract 1 (since level 1 means 0 levels cleared)
        const physicsLevel = parseInt(physics.level || '1') - 1;
        const chemistryLevel = parseInt(chemistry.level || '1') - 1;
        const botanyLevel = parseInt(botany.level || '1') - 1;
        const zoologyLevel = parseInt(zoology.level || '1') - 1;
        
        // Sum up the levels cleared (ensure they're not negative)
        totalLevelsCleared = 
          Math.max(0, physicsLevel) + 
          Math.max(0, chemistryLevel) + 
          Math.max(0, botanyLevel) + 
          Math.max(0, zoologyLevel);
      }
      
      // Calculate N.POINTS (25 points per level cleared)
      const nPoints = totalLevelsCleared * 25;
      
      return {
        _id: student._id,
        studentId: student.studentId,
        name: student.name,
        subjects: student.subjects,
        nPoints
      };
    });
    
    // Sort by nPoints in descending order
    studentsWithPoints.sort((a, b) => b.nPoints - a.nPoints);
    
    res.json(studentsWithPoints);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all students with N.POINTS calculation
app.get('/admin/students/points', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const students = await Student.find({}, '-password').lean();
    
    // Calculate N.POINTS for each student
    const studentsWithPoints = students.map(student => {
      let totalLevelsCleared = 0;
      
      if (student.subjects) {
        const { physics, chemistry, botany, zoology } = student.subjects;
        
        // Convert level strings to numbers and subtract 1 (since level 1 means 0 levels cleared)
        const physicsLevel = parseInt(physics.level) - 1;
        const chemistryLevel = parseInt(chemistry.level) - 1;
        const botanyLevel = parseInt(botany.level) - 1;
        const zoologyLevel = parseInt(zoology.level) - 1;
        
        // Sum up the levels cleared (ensure they're not negative)
        totalLevelsCleared = 
          Math.max(0, physicsLevel) + 
          Math.max(0, chemistryLevel) + 
          Math.max(0, botanyLevel) + 
          Math.max(0, zoologyLevel);
      }
      
      // Calculate N.POINTS (25 points per level cleared)
      const nPoints = totalLevelsCleared * 25;
      
      return {
        ...student,
        levelsCleared: totalLevelsCleared,
        nPoints
      };
    });
    
    // Sort students by N.POINTS in descending order
    studentsWithPoints.sort((a, b) => b.nPoints - a.nPoints);
    
    res.json(studentsWithPoints);
  } catch (error) {
    console.error('Error fetching students with points:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add root route for API info
app.get('/', (req, res) => {
  res.json({
    message: 'Zerreta NEET Preparation API',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      auth: '/login',
      admin: '/admin/*',
      student: '/student/*'
    }
  });
});

// Add health check endpoints for debugging
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend server is up and running',
    timestamp: new Date().toISOString()
  });
});

// Simple echo endpoint to test request/response
app.post('/api/echo', (req, res) => {
  res.json({
    message: 'Echo endpoint successful',
    receivedData: req.body,
    headers: {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      contentType: req.headers['content-type']
    }
  });
});

// New endpoint for backward compatibility
app.post('/student/test/submit', authenticateToken, async (req, res) => {
  try {
    // Forward to the new endpoint
    const { 
      subject, 
      stage, 
      level, 
      answers, 
      score, 
      timeTaken,
      passedLevel 
    } = req.body;
    
    const studentId = req.user.id;
    
    console.log(`Forwarding test submission to /student/complete-test endpoint for student ${studentId}`);
    
    // Create test history record
    const testResult = new TestHistory({
      studentId,
      subject,
      stage,
      level,
      score,
      questions: answers.map(a => ({
        questionId: a.questionId,
        selectedOption: a.selectedOption,
        isCorrect: a.isCorrect || false
      })),
      totalTime: Math.round(timeTaken / 60), // Convert seconds to minutes
      passedLevel: passedLevel || score >= 70, // Default passing threshold is 70%
      date: new Date()
    });
    
    await testResult.save();
    console.log('Test history saved successfully with ID:', testResult._id);
    
    // Return success
    res.status(201).json({ 
      message: 'Test result saved successfully',
      testId: testResult._id,
      results: answers
    });
  } catch (error) {
    console.error('Error saving test history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all unique institutions
app.get('/admin/institutions', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Find all unique institution values
    const institutions = await Student.distinct('institution');
    
    res.status(200).json(institutions);
  } catch (error) {
    console.error('Error fetching institutions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get students by institution
app.get('/admin/students/institution/:institution', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const { institution } = req.params;
    
    // Find all students from a specific institution
    const students = await Student.find({ institution });
    
    res.status(200).json(students);
  } catch (error) {
    console.error('Error fetching students by institution:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 