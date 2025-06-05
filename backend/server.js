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

// MongoDB Connection with improved error handling
console.log('Connecting to MongoDB...');
console.log('Using connection string:', process.env.MONGODB_URI ? 'Connection string is set' : 'Connection string is missing!');

const connectWithRetry = () => {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/student-auth', {
    useNewUrlParser: true, 
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
  })
  .then(() => {
    console.log('Connected to MongoDB successfully');
    // Create initial users after successful connection
    createAdminUser();
    createTestStudent();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  });
};

// Set up mongoose connection event listeners
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected, attempting to reconnect...');
  setTimeout(connectWithRetry, 5000);
});

// Initial connection attempt
connectWithRetry();

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

// Import Student model
const Student = require('./models/Student');
// Import Question model
const Question = require('./models/Question');
// Import Grammar Question model
const GrammarQuestion = require('./models/GrammarQuestion');

// Test History Schema
const testHistorySchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  subject: { type: String, required: true },
  stage: { type: String, default: '1' }, // Legacy field, keep for backward compatibility
  level: { type: String, default: '1' }, // Legacy field, keep for backward compatibility
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
    explanation: String,
    topicNumber: String, // Track which topic a question belongs to
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    attemptCount: { type: Number, default: 1 }, // Track if this question was attempted multiple times
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' } // Reference to original question
  }],
  date: { type: Date, default: Date.now },
  // Fields for topic-based tests
  testMode: { type: String, enum: ['practice', 'assessment'], required: true }, // Indicates if this is a practice or assessment test
  topicNumber: { type: String }, // Topic number for practice tests
  topics: [{ type: String }], // Array of topics for assessment tests
  
  // Enhanced analytics fields
  deviceInfo: {
    browser: String,
    platform: String,
    screenSize: String
  },
  timingDetails: {
    startTime: { type: Date },
    endTime: { type: Date },
    pauseDuration: { type: Number, default: 0 }, // Time spent in paused state in seconds
    questionTransitionTimes: [Number] // Time taken to move between questions
  },
  performanceMetrics: {
    correctAnswers: { type: Number, default: 0 },
    incorrectAnswers: { type: Number, default: 0 },
    unanswered: { type: Number, default: 0 },
    topicWisePerformance: mongoose.Schema.Types.Mixed, // Object with topic numbers as keys and scores as values
    averageTimePerQuestion: { type: Number, default: 0 }
  },
  userActions: {
    optionChanges: { type: Number, default: 0 }, // How many times user changed their answer
    reviewMarked: [Number] // Question numbers marked for review
  },
  // Flag to track if this attempt was completed or abandoned
  isCompleted: { type: Boolean, default: true },
  // Comparison with previous attempts
  improvement: {
    previousBestScore: { type: Number, default: 0 },
    scoreImprovement: { type: Number, default: 0 },
    timeImprovement: { type: Number, default: 0 }
  }
});

const TestHistory = mongoose.model('TestHistory', testHistorySchema);

// Middleware to authenticate token - enhanced version
const authenticateToken = (req, res, next) => {
  console.log('Authenticating token...');
  const authHeader = req.headers['authorization'];
  console.log('Authorization header:', authHeader ? 'Present' : 'Missing');
  
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ 
      message: 'Access denied',
      error: 'NO_TOKEN_PROVIDED'
    });
  }

  try {
    console.log('Verifying token...');
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Ensure the token has the required fields
    if (!decoded.userId || !decoded.role) {
      console.error('Token missing required fields');
      return res.status(403).json({ 
        message: 'Invalid token format',
        error: 'INVALID_TOKEN_FORMAT'
      });
    }
    
    console.log('Token decoded successfully:', { 
      userId: decoded.userId,
      role: decoded.role,
      username: decoded.username
    });
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    res.status(403).json({ 
      message: 'Invalid token',
      error: 'INVALID_TOKEN'
    });
  }
};

// Add this middleware after the authenticateToken middleware
const adminOnly = (req, res, next) => {
  // Check if the user is an admin
  if (req.user.role !== 'admin') {
    console.log('Unauthorized admin access attempt:', req.user);
    return res.status(403).json({ 
      message: 'Access denied. Admin privileges required.',
      error: 'UNAUTHORIZED_ROLE'
    });
  }
  next();
};

// Add studentOnly middleware similar to adminOnly
const studentOnly = (req, res, next) => {
  // Check if the user is a student
  if (req.user.role !== 'student') {
    console.log('Unauthorized student access attempt:', req.user);
    return res.status(403).json({ 
      message: 'Access denied. Student privileges required.',
      error: 'UNAUTHORIZED_ROLE'
    });
  }
  next();
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
      { 
        userId: user._id, 
        role: user.role,
        username: user.username  // Add username to token
      },
      JWT_SECRET,
      { expiresIn: '24h' }  // Extend token lifetime to 24 hours
    );

    console.log('Login successful for user:', username);
    res.json({ 
      token, 
      role: user.role,
      username: user.username  // Return username in response
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Student Management Routes (Admin only)

// Create a new student
app.post('/admin/students', authenticateToken, adminOnly, async (req, res) => {
  try {
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
app.get('/admin/students', authenticateToken, adminOnly, async (req, res) => {
  console.log('GET /admin/students endpoint called');
  try {
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
app.get('/admin/students/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
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
app.put('/admin/students/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
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
app.delete('/admin/students/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
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
app.get('/student/profile', authenticateToken, studentOnly, async (req, res) => {
  try {
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

    // Get a plain JavaScript object from the Mongoose document
    const studentObj = student.toObject();
    
    // Check if req.query.force is truthy - this means we want to force a direct DB check
    if (req.query.force) {
      console.log('Force refresh requested for student profile');
      
      // Connect to MongoDB directly to get full subject data
      try {
        const directDb = mongoose.connection.db;
        const studentsCollection = directDb.collection('students');
        
        // Find the student directly
        const rawStudent = await studentsCollection.findOne({ username: user.username });
        
        // Update the subjects with any capitalized versions
        if (rawStudent && rawStudent.subjects) {
          console.log('Raw subjects from DB:', Object.keys(rawStudent.subjects));
          
          // Replace subjects with the raw version from the DB
          studentObj.subjects = rawStudent.subjects;
          
          console.log('Updated student object with raw subjects:', Object.keys(studentObj.subjects));
        }
      } catch (dbErr) {
        console.error('Error getting raw student data:', dbErr);
        // Continue with the normal response if direct DB access fails
      }
    }
    
    // Make sure we always have capitalized versions of subjects
    if (studentObj.subjects) {
      const subjects = studentObj.subjects;
      
      // For each lowercase subject, also add a capitalized version if not present
      if (subjects.physics && !subjects.Physics) {
        subjects.Physics = { ...subjects.physics };
      }
      
      if (subjects.chemistry && !subjects.Chemistry) {
        subjects.Chemistry = { ...subjects.chemistry };
      }
      
      if (subjects.botany && !subjects.Botany) {
        subjects.Botany = { ...subjects.botany };
      }
      
      if (subjects.zoology && !subjects.Zoology) {
        subjects.Zoology = { ...subjects.zoology };
      }
      
      // Also do the reverse - add lowercase if only capitalized exists
      if (subjects.Physics && !subjects.physics) {
        subjects.physics = { ...subjects.Physics };
      }
      
      if (subjects.Chemistry && !subjects.chemistry) {
        subjects.chemistry = { ...subjects.Chemistry };
      }
      
      if (subjects.Botany && !subjects.botany) {
        subjects.botany = { ...subjects.Botany };
      }
      
      if (subjects.Zoology && !subjects.zoology) {
        subjects.zoology = { ...subjects.Zoology };
      }
      
      console.log('Final subject keys in response:', Object.keys(subjects));
    }

    res.json(studentObj);
  } catch (error) {
    console.error('Error getting student profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Question Management Routes

// Create a new question (Admin only)
app.post('/admin/questions', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { subject, topicNumber, questionText, options, correctOption, explanation, difficulty, imageUrl, timeAllocation } = req.body;

    console.log('Creating question with data:', { 
      subject, topicNumber, questionText, 
      options: options ? options.length : 'none', 
      correctOption, 
      imageUrl: imageUrl || 'none',
      explanation: explanation ? `${explanation.substring(0, 30)}... (${explanation.length} chars)` : 'none'
    });

    if (!subject || !topicNumber || !questionText) {
      return res.status(400).json({ message: 'Required fields missing: subject, topicNumber or questionText' });
    }

    // Validate options array
    if (!options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ message: 'Required field missing: options must be an array with at least 2 items' });
    }

    // Validate at least one non-empty option
    if (options.every(option => !option || option.trim() === '')) {
      return res.status(400).json({ message: 'At least one option must not be empty' });
    }

    // Validate correctOption
    if (correctOption === undefined || correctOption === null || isNaN(Number(correctOption))) {
      return res.status(400).json({ message: 'Required field missing: correctOption must be a number' });
    }

    // Ensure explanation is properly formatted
    let processedExplanation = explanation || '';
    if (processedExplanation === 'undefined' || processedExplanation === 'null') {
      processedExplanation = '';
    }

    console.log('Processing explanation:', processedExplanation ? 'YES' : 'NO', 'Length:', processedExplanation.length);

    // Create new question
    const newQuestion = new Question({
      subject,
      topicNumber,
      questionText,
      options,
      correctOption,
      explanation: processedExplanation,
      difficulty: difficulty || 'medium',
      imageUrl: imageUrl || '',
      timeAllocation: timeAllocation || 60
    });

    await newQuestion.save();
    console.log('Question created successfully with ID:', newQuestion._id);
    console.log('Image URL saved:', newQuestion.imageUrl);
    console.log('Explanation saved:', processedExplanation ? `(${processedExplanation.length} chars)` : 'none');
    
    res.status(201).json({ message: 'Question created successfully', question: newQuestion });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk upload questions (Admin only)
app.post('/admin/questions/bulk', authenticateToken, adminOnly, async (req, res) => {
  try {
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
      
      if (!question.subject || !question.topicNumber || 
          !question.questionText || !question.options || question.correctOption === undefined) {
        console.error(`Validation failed for question ${i}:`, JSON.stringify(question, null, 2));
        return res.status(400).json({ 
          message: `Question at index ${i} is missing required fields: ${
            [
              !question.subject ? 'subject' : null,
              !question.topicNumber ? 'topicNumber' : null,
              !question.questionText ? 'questionText' : null,
              !question.options ? 'options' : null,
              question.correctOption === undefined ? 'correctOption' : null
            ].filter(Boolean).join(', ')
          }` 
        });
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
app.get('/admin/questions', authenticateToken, adminOnly, async (req, res) => {
  try {
    // Get filter parameters
    const { subject, topicNumber } = req.query;
    const filter = {};
    
    if (subject) filter.subject = subject;
    if (topicNumber) filter.topicNumber = topicNumber;
    
    const questions = await Question.find(filter);
    res.json(questions);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific question by ID (Admin only)
app.get('/admin/questions/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
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
app.put('/admin/questions/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { subject, topicNumber, questionText, options, correctOption, explanation, difficulty, imageUrl, timeAllocation } = req.body;

    console.log('Updating question with data:', { 
      id: req.params.id,
      subject, topicNumber, questionText, 
      options: options ? options.length : 'none', 
      correctOption, 
      imageUrl: imageUrl || 'none'
    });

    const updatedQuestion = await Question.findByIdAndUpdate(
      req.params.id,
      { 
        subject,
        topicNumber,
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
app.delete('/admin/questions/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
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

// =====================================================
// GRAMMAR QUESTION ROUTES
// =====================================================

// Get all grammar questions with filtering (Admin only)
app.get('/admin/grammar-questions', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { module, topicNumber } = req.query;
    console.log('Fetching grammar questions with filters:', { module, topicNumber });
    
    let query = {};
    
    if (module) {
      query.module = module;
    }
    
    if (topicNumber) {
      query.topicNumber = topicNumber;
    }
    
    const questions = await GrammarQuestion.find(query).sort({ createdAt: -1 });
    console.log(`Found ${questions.length} grammar questions`);
    
    res.json(questions);
  } catch (error) {
    console.error('Error fetching grammar questions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get grammar questions for students (for tests)
app.get('/grammar-questions', authenticateToken, studentOnly, async (req, res) => {
  try {
    const { module, topicNumber } = req.query;
    console.log('Student fetching grammar questions:', { module, topicNumber });
    
    if (!module) {
      return res.status(400).json({ message: 'Module is required' });
    }
    
    let query = { module };
    
    if (topicNumber) {
      query.topicNumber = topicNumber;
    }
    
    const questions = await GrammarQuestion.find(query).lean();
    console.log(`Found ${questions.length} grammar questions for module: ${module}`);
    
    res.json(questions);
  } catch (error) {
    console.error('Error fetching grammar questions for student:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new grammar question (Admin only)
app.post('/admin/grammar-questions', authenticateToken, adminOnly, async (req, res) => {
  try {
    console.log('=== GRAMMAR QUESTION CREATION DEBUG ===');
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    console.log('Connection states: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting');
    console.log('Creating new grammar question with data:', JSON.stringify(req.body, null, 2));
    
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      console.error('Database not connected! Current state:', mongoose.connection.readyState);
      return res.status(500).json({ 
        message: 'Database connection error. Please try again.',
        connectionState: mongoose.connection.readyState
      });
    }
    
    const {
      module,
      topicNumber,
      questionText,
      options,
      correctOption,
      explanation,
      difficulty,
      timeAllocation,
      imageUrl,
      grammarRule,
      category
    } = req.body;
    
    console.log('Extracted fields:', {
      module,
      topicNumber,
      questionText: questionText ? questionText.substring(0, 50) + '...' : 'undefined',
      options: options ? `Array of ${options.length} items` : 'undefined',
      correctOption,
      explanation: explanation ? 'provided' : 'not provided',
      difficulty,
      timeAllocation,
      imageUrl: imageUrl ? 'provided' : 'not provided',
      grammarRule: grammarRule ? 'provided' : 'not provided',
      category
    });
    
    // Validate required fields
    if (!module || !topicNumber || !questionText || !options || correctOption === undefined) {
      console.error('Validation failed - missing required fields:', {
        module: !!module,
        topicNumber: !!topicNumber,
        questionText: !!questionText,
        options: !!options,
        correctOption: correctOption !== undefined
      });
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: { 
          module: !!module, 
          topicNumber: !!topicNumber, 
          questionText: !!questionText, 
          options: !!options, 
          correctOption: correctOption !== undefined 
        }
      });
    }
    
    // Validate options array
    if (!Array.isArray(options) || options.length !== 4) {
      console.error('Options validation failed:', {
        isArray: Array.isArray(options),
        length: options ? options.length : 'N/A'
      });
      return res.status(400).json({ message: 'Options must be an array of 4 items' });
    }
    
    // Check if any option is empty
    const emptyOptions = options.filter(opt => !opt || opt.trim() === '');
    if (emptyOptions.length > 0) {
      console.error('Empty options found:', emptyOptions.length);
      return res.status(400).json({ message: 'All options must be filled' });
    }
    
    // Validate correct option index
    if (correctOption < 0 || correctOption >= options.length) {
      console.error('Invalid correct option index:', correctOption, 'Options length:', options.length);
      return res.status(400).json({ message: 'Correct option index is invalid' });
    }
    
    // Validate module enum
    const validModules = ['beginner', 'basic', 'intermediate', 'advanced'];
    if (!validModules.includes(module)) {
      console.error('Invalid module:', module, 'Valid modules:', validModules);
      return res.status(400).json({ message: 'Invalid module. Must be one of: ' + validModules.join(', ') });
    }
    
    // Validate difficulty enum
    const validDifficulties = ['easy', 'medium', 'hard'];
    const finalDifficulty = difficulty || 'medium';
    if (!validDifficulties.includes(finalDifficulty)) {
      console.error('Invalid difficulty:', finalDifficulty, 'Valid difficulties:', validDifficulties);
      return res.status(400).json({ message: 'Invalid difficulty. Must be one of: ' + validDifficulties.join(', ') });
    }
    
    // Validate category enum
    const validCategories = ['tenses', 'articles', 'prepositions', 'modal-verbs', 'conditionals', 'passive-voice', 'reported-speech', 'relative-clauses', 'conjunctions', 'phrasal-verbs', 'others'];
    const finalCategory = category || 'others';
    if (!validCategories.includes(finalCategory)) {
      console.error('Invalid category:', finalCategory, 'Valid categories:', validCategories);
      return res.status(400).json({ message: 'Invalid category. Must be one of: ' + validCategories.join(', ') });
    }
    
    console.log('All validations passed. Creating question object...');
    
    const questionData = {
      module,
      topicNumber: topicNumber.toString(),
      questionText: questionText.trim(),
      options: options.map(opt => opt.trim()),
      correctOption: parseInt(correctOption),
      explanation: (explanation || '').trim(),
      difficulty: finalDifficulty,
      timeAllocation: parseInt(timeAllocation) || 60,
      imageUrl: (imageUrl || '').trim(),
      grammarRule: (grammarRule || '').trim(),
      category: finalCategory
    };
    
    console.log('Final question data:', JSON.stringify(questionData, null, 2));
    
    // Test if GrammarQuestion model is available
    if (!GrammarQuestion) {
      console.error('GrammarQuestion model is not available!');
      return res.status(500).json({ message: 'Grammar question model not loaded' });
    }
    
    console.log('Creating new GrammarQuestion instance...');
    const newQuestion = new GrammarQuestion(questionData);
    
    console.log('Validating question before save...');
    const validationError = newQuestion.validateSync();
    if (validationError) {
      console.error('Validation error:', validationError);
      return res.status(400).json({ 
        message: 'Validation error', 
        details: validationError.message 
      });
    }
    
    console.log('Attempting to save to database...');
    const savedQuestion = await newQuestion.save();
    console.log('Grammar question created successfully with ID:', savedQuestion._id);
    
    res.status(201).json(savedQuestion);
  } catch (error) {
    console.error('=== ERROR SAVING GRAMMAR QUESTION ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Check for specific error types
    if (error.name === 'ValidationError') {
      console.error('Mongoose validation error details:', error.errors);
      return res.status(400).json({ 
        message: 'Validation error', 
        error: error.message,
        details: error.errors
      });
    }
    
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      console.error('MongoDB/Mongoose error:', error);
      return res.status(500).json({ 
        message: 'Database error. Please check connection.', 
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      message: 'Server error creating grammar question', 
      error: error.message,
      type: error.constructor.name
    });
  }
});

// Update a grammar question (Admin only)
app.put('/admin/grammar-questions/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    console.log('Updating grammar question:', req.params.id);
    
    const {
      module,
      topicNumber,
      questionText,
      options,
      correctOption,
      explanation,
      difficulty,
      timeAllocation,
      imageUrl,
      grammarRule,
      category
    } = req.body;
    
    const updatedQuestion = await GrammarQuestion.findByIdAndUpdate(
      req.params.id,
      {
        module,
        topicNumber,
        questionText,
        options,
        correctOption,
        explanation,
        difficulty,
        timeAllocation,
        imageUrl,
        grammarRule,
        category
      },
      { new: true, runValidators: true }
    );
    
    if (!updatedQuestion) {
      return res.status(404).json({ message: 'Grammar question not found' });
    }
    
    console.log('Grammar question updated successfully:', updatedQuestion._id);
    res.json(updatedQuestion);
  } catch (error) {
    console.error('Error updating grammar question:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a grammar question (Admin only)
app.delete('/admin/grammar-questions/:id', authenticateToken, adminOnly, async (req, res) => {
  try {
    const deletedQuestion = await GrammarQuestion.findByIdAndDelete(req.params.id);
    
    if (!deletedQuestion) {
      return res.status(404).json({ message: 'Grammar question not found' });
    }
    
    console.log('Grammar question deleted successfully:', req.params.id);
    res.json({ message: 'Grammar question deleted successfully' });
  } catch (error) {
    console.error('Error deleting grammar question:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk upload grammar questions (Admin only)
app.post('/admin/grammar-questions/bulk', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { questions } = req.body;
    
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'Questions array is required and must not be empty' });
    }
    
    console.log('Received bulk upload request for grammar questions with', questions.length, 'questions');
    
    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      // Check required fields
      if (!question.module || !question.topicNumber || !question.questionText || 
          !question.options || !Array.isArray(question.options) || question.options.length !== 4 ||
          typeof question.correctOption !== 'number' || question.correctOption < 0 || question.correctOption > 3) {
        return res.status(400).json({ 
          message: `Question ${i + 1} is invalid. Required fields: module, topicNumber, questionText, options (array of 4), correctOption (0-3)` 
        });
      }
      
      // Validate options are not empty
      if (question.options.some(option => !option || option.trim().length === 0)) {
        return res.status(400).json({ 
          message: `Question ${i + 1} has empty options. All options must have text.` 
        });
      }
    }
    
    // Insert all questions
    const savedQuestions = await GrammarQuestion.insertMany(questions);
    
    console.log(`Successfully uploaded ${savedQuestions.length} grammar questions`);
    
    res.status(201).json({
      success: true,
      message: `${savedQuestions.length} grammar questions uploaded successfully`,
      count: savedQuestions.length
    });
    
  } catch (error) {
    console.error('Error handling bulk upload for grammar questions:', error);
    res.status(500).json({
      success: false,
      message: 'Server error processing bulk upload',
      error: error.message
    });
  }
});

// Student endpoint to get topic-based test questions
app.get('/student/test', authenticateToken, studentOnly, async (req, res) => {
  try {
    // Extract test parameters from query
    const { subject, mode } = req.query;
    
    if (!subject) {
      return res.status(400).json({ message: 'Subject is required' });
    }
    
    let query = { subject: subject.toLowerCase() };
    let questionCount = 20;  // Default number of questions
    
    // Handle different test modes
    if (mode === 'practice') {
      // For practice mode, filter by topic number
      const { topicNumber } = req.query;
      
      if (!topicNumber) {
        return res.status(400).json({ message: 'Topic number is required for practice mode' });
      }
      
      query.topicNumber = topicNumber;
      questionCount = 20;  // 20 questions for practice tests
    } 
    else if (mode === 'assessment') {
      // For assessment mode, filter by selected topics
      const { topics, count } = req.query;
      
      if (!topics) {
        return res.status(400).json({ message: 'Topics are required for assessment mode' });
      }
      
      const topicsList = topics.split(',');
      query.topicNumber = { $in: topicsList };
      
      // Use requested count or default to 40
      questionCount = parseInt(count) || 40;
    }
    
    // Fetch all matching questions
    let questions = await Question.find(query).lean();
    
    // Return questions
    res.json({
      subject,
      mode,
      questions: questions.map(q => ({
        id: q._id,
        text: q.questionText,
        options: q.options,
        correctOption: q.correctOption,
        topicNumber: q.topicNumber,
        explanation: q.explanation,
        timeAllocation: q.timeAllocation || 60
      }))
    });
  } catch (error) {
    console.error('Error fetching test questions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Process test completion and save results
app.post('/student/complete-test', authenticateToken, studentOnly, async (req, res) => {
  try {
    // Extract required fields from request body
    const { subject, stage, level, score, questions, totalTime, passedLevel, mode, topicNumber, topics } = req.body;
    const studentId = req.user.userId;
    
    console.log('======= TEST COMPLETION =======');
    console.log('Student ID:', studentId);
    console.log('User in token:', req.user);
    console.log('Subject:', subject);
    console.log('Mode:', mode);
    
    if (mode === 'practice') {
      console.log('Practice test for Topic:', topicNumber);
    } else if (mode === 'assessment') {
      console.log('Assessment test for Topics:', topics);
    } else {
      console.log('Legacy test - Stage:', stage, 'Level:', level);
    }
    
    console.log('Score:', score);
    console.log('Passed:', passedLevel || score >= 70);
    
    // Validate required fields
    if (!subject || !questions || score === undefined || totalTime === undefined) {
      console.error('Missing required fields in test completion request');
      return res.status(400).json({ 
        message: 'Missing required fields', 
        details: { 
          subject: !!subject, 
          questions: !!questions, 
          score: score !== undefined, 
          totalTime: totalTime !== undefined 
        } 
      });
    }
    
    // Process questions data
    const processedQuestions = questions.map(q => ({
      text: q.text || q.questionText || 'Question text not available',
      selectedOption: q.selectedOption || '',
      correctOption: q.correctOption,
      isCorrect: q.isCorrect,
      timeSpent: q.timeSpent || 0,
      allocatedTime: q.allocatedTime || 60,
      explanation: q.explanation || 'No explanation available',
      topicNumber: q.topicNumber || q.topic || topicNumber || '',
      questionId: q._id || null,
      difficulty: q.difficulty || 'medium'
    }));
    
    // Calculate performance metrics
    const correctAnswers = processedQuestions.filter(q => q.isCorrect).length;
    const incorrectAnswers = processedQuestions.filter(q => !q.isCorrect).length;
    const unanswered = processedQuestions.length - correctAnswers - incorrectAnswers;
    const averageTimePerQuestion = processedQuestions.length > 0 ? 
      processedQuestions.reduce((sum, q) => sum + (q.timeSpent || 0), 0) / processedQuestions.length : 0;
    
    // Calculate topic-wise performance
    const topicWisePerformance = {};
    processedQuestions.forEach(q => {
      const topic = q.topicNumber || '1'; // Default to '1' if no topic
      if (!topicWisePerformance[topic]) {
        topicWisePerformance[topic] = {
          total: 0,
          correct: 0,
          score: 0
        };
      }
      
      topicWisePerformance[topic].total++;
      if (q.isCorrect) {
        topicWisePerformance[topic].correct++;
      }
    });
    
    // Calculate score for each topic
    Object.keys(topicWisePerformance).forEach(topic => {
      const { total, correct } = topicWisePerformance[topic];
      topicWisePerformance[topic].score = total > 0 ? Math.round((correct / total) * 100) : 0;
    });
    
    // Get browser and platform info if available
    const userAgent = req.headers['user-agent'] || '';
    const deviceInfo = {
      browser: getBrowserInfo(userAgent),
      platform: getPlatformInfo(userAgent),
      screenSize: req.body.screenSize || 'unknown'
    };
    
    // Calculate improvements compared to previous attempts
    let improvement = {
      previousBestScore: 0,
      scoreImprovement: 0,
      timeImprovement: 0
    };
    
    try {
      // Find previous attempts for this subject/topic
      let query = { studentId, subject };
      if (mode === 'practice' && topicNumber) {
        query.topicNumber = topicNumber;
      } else if (mode === 'assessment' && topics && topics.length > 0) {
        // More complex query for assessment tests
        query.testMode = 'assessment';
      }
      
      const previousAttempts = await TestHistory.find(query)
        .sort({ date: -1 })
        .limit(5);
      
      if (previousAttempts && previousAttempts.length > 0) {
        // Find previous best score
        const previousBestScore = Math.max(...previousAttempts.map(a => a.score || 0));
        
        // Find previous average time
        const previousAverageTime = previousAttempts.length > 0 ? 
          previousAttempts.reduce((sum, a) => sum + (a.totalTime || 0), 0) / previousAttempts.length : 0;
        
        improvement = {
          previousBestScore,
          scoreImprovement: score - previousBestScore,
          timeImprovement: previousAverageTime - totalTime
        };
      }
    } catch (improvementError) {
      console.error('Error calculating improvement metrics:', improvementError);
      // Continue without improvement data
    }
    
    let testResult;
    
    // Create test history entry based on mode
    if (mode === 'practice' || mode === 'assessment') {
      testResult = new TestHistory({
        studentId,
        subject,
        score,
        questions: processedQuestions,
        totalTime: totalTime || 0,
        passedLevel: passedLevel || score >= 70,
        date: new Date(),
        // Topic-specific data
        testMode: mode,
        topicNumber: mode === 'practice' ? topicNumber : undefined,
        topics: mode === 'assessment' ? topics : undefined,
        // Enhanced analytics fields
        deviceInfo,
        timingDetails: {
          startTime: req.body.startTime ? new Date(req.body.startTime) : new Date(Date.now() - (totalTime * 60 * 1000)),
          endTime: new Date(),
          pauseDuration: req.body.pauseDuration || 0,
          questionTransitionTimes: req.body.questionTransitionTimes || []
        },
        performanceMetrics: {
          correctAnswers,
          incorrectAnswers,
          unanswered,
          topicWisePerformance,
          averageTimePerQuestion
        },
        userActions: {
          optionChanges: req.body.optionChanges || 0,
          reviewMarked: req.body.reviewMarked || []
        },
        isCompleted: true,
        improvement
      });
    } else {
      // Legacy stage-level test
      testResult = new TestHistory({
        studentId,
        subject,
        stage,
        level,
        score,
        questions: processedQuestions,
        totalTime: totalTime || 0,
        passedLevel: passedLevel || score >= 70,
        date: new Date(),
        testMode: 'practice', // Default mode for backward compatibility
        deviceInfo,
        performanceMetrics: {
          correctAnswers,
          incorrectAnswers, 
          unanswered,
          averageTimePerQuestion
        },
        isCompleted: true
      });
    }
    
    // Save the test result
    await testResult.save();
    console.log('Test history saved successfully with ID:', testResult._id);
    
    // For practice tests, update topic progress
    if (mode === 'practice' && topicNumber) {
      try {
        // Find student to update topic progress
        const student = await Student.findOne({ studentId });
        
        if (student) {
          // Initialize topic progress if needed
          if (!student.topicProgress) {
            student.topicProgress = {};
          }
          if (!student.topicProgress[subject]) {
            student.topicProgress[subject] = {};
          }
          
          // Get current topic data or initialize
          const currentTopicData = student.topicProgress[subject][topicNumber] || {
            progress: 0,
            completed: false,
            attemptsCount: 0
          };
          
          // Update topic progress
          student.topicProgress[subject][topicNumber] = {
            progress: Math.max(currentTopicData.progress, score || 0),
            completed: score >= 70 || currentTopicData.completed,
            attemptsCount: (currentTopicData.attemptsCount || 0) + 1,
            lastAttemptDate: new Date()
          };
          
          await student.save();
          console.log(`Updated topic progress for ${subject} topic ${topicNumber} to ${score}%`);
        }
      } catch (progressError) {
        console.error('Error updating topic progress:', progressError);
        // Continue execution even if progress update fails
      }
    }
    
    console.log('======= TEST COMPLETION FINISHED =======\n\n');
    
    res.status(201).json({ 
      message: 'Test result saved successfully',
      testId: testResult._id,
      results: questions
    });
  } catch (error) {
    console.error('Error in test completion endpoint:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      details: error.stack 
    });
  }
});

// Helper functions for user agent parsing
function getBrowserInfo(userAgent) {
  if (!userAgent) return 'unknown';
  
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Edg')) return 'Edge';
  if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) return 'Internet Explorer';
  
  return 'Other';
}

function getPlatformInfo(userAgent) {
  if (!userAgent) return 'unknown';
  
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac OS')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  
  return 'Other';
}

// Store test result in history
app.post('/student/test-history', authenticateToken, studentOnly, async (req, res) => {
  try {
    const { subject, stage, level, score, questions, totalTime, passedLevel } = req.body;
    const studentId = req.user.userId;
    
    console.log('Received test history data:', {
      subject,
      stage,
      level,
      score,
      totalTime,
      passedLevel,
      studentId,
      questionCount: questions?.length
    });

    if (!subject || !stage || !level || !questions || score === undefined || totalTime === undefined) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: {
          subject: !subject,
          stage: !stage,
          level: !level,
          questions: !questions,
          score: score === undefined,
          totalTime: totalTime === undefined
        }
      });
    }

    if (!studentId) {
      return res.status(400).json({ 
        message: 'Student ID not found in token',
        error: 'Missing studentId'
      });
    }

    // Create new test history entry
    const testResult = new TestHistory({
      studentId,
      subject,
      stage,
      level,
      score,
      questions: questions.map(q => ({
        text: q.text,
        selectedOption: q.selectedOption || '',
        correctOption: q.correctOption,
        isCorrect: q.isCorrect,
        timeSpent: q.timeSpent || 0,
        allocatedTime: q.allocatedTime || 60,
        explanation: q.explanation || 'No explanation available'
      })),
      totalTime,
      passedLevel,
      date: new Date()
    });
    
    console.log('Saving test result with ID:', testResult._id);
    await testResult.save();
    console.log('Test result saved successfully');

    // Update student level if they passed
    if (passedLevel) {
      try {
        // Get the student from the database
        const student = await Student.findOne({ username: req.user.username });
        console.log('Student data before update:', student?.username, student?.subjects);
        
        if (!student) {
          console.error('Student not found');
          return;
        }
        
        // Initialize subjects object if needed
        if (!student.subjects) {
          student.subjects = {};
        }
        
        // Normalize subject name to lowercase for consistency
        const subjectKey = subject.toLowerCase();
        console.log('Processing subject:', subjectKey);
        
        // Initialize subject if it doesn't exist
        if (!student.subjects[subjectKey]) {
          console.log(`Creating new subject entry for ${subjectKey}`);
          student.subjects[subjectKey] = { stage: '1', level: '1' };
        }
        
        // DIRECT APPROACH: Simply increment the level by 1 when a test is passed
        let currentLevel = parseInt(student.subjects[subjectKey].level) || 1;
        let currentStage = parseInt(student.subjects[subjectKey].stage) || 1;
        
        console.log(`Current ${subjectKey} progress - Stage: ${currentStage}, Level: ${currentLevel}`);
        
        // Increment level
        currentLevel += 1;
        
        // If level exceeds 4, move to next stage
        if (currentLevel > 4) {
          currentLevel = 1;
          currentStage += 1;
        }
        
        // Update the student record
        student.subjects[subjectKey].level = currentLevel.toString();
        student.subjects[subjectKey].stage = currentStage.toString();
        
        // Save the updated student record
        await student.save();
        
        console.log(`LEVEL UPDATED: ${subjectKey} - New Stage: ${currentStage}, New Level: ${currentLevel}`);
      } catch (error) {
        console.error('Error updating student level:', error);
      }
    }
    
    // Return the created test history object
    res.status(201).json({
      _id: testResult._id,
      studentId: testResult.studentId,
      subject: testResult.subject,
      stage: testResult.stage,
      level: testResult.level,
      score: testResult.score,
      questions: testResult.questions,
      totalTime: testResult.totalTime,
      passedLevel: testResult.passedLevel,
      date: testResult.date
    });
  } catch (error) {
    console.error('Error saving test history:', error);
    res.status(500).json({ 
      message: 'Failed to save test results',
      error: error.message,
      details: error.stack
    });
  }
});

// Get test history for a student
app.get('/student/test-history', authenticateToken, studentOnly, async (req, res) => {
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

// Save grammar test results
app.post('/grammar-test-history', authenticateToken, studentOnly, async (req, res) => {
  try {
    const { 
      module, 
      topicNumber, 
      score, 
      questions, 
      totalTime, 
      testMode, 
      timingDetails, 
      performanceMetrics 
    } = req.body;
    const studentId = req.user.userId;
    
    console.log('Saving grammar test results:', {
      studentId,
      module,
      topicNumber,
      score,
      testMode,
      questionCount: questions?.length
    });

    // Validate required fields
    if (!module || !questions || score === undefined || totalTime === undefined) {
      return res.status(400).json({ 
        message: 'Missing required fields',
        details: { 
          module: !!module, 
          questions: !!questions, 
          score: score !== undefined, 
          totalTime: totalTime !== undefined 
        } 
      });
    }

    // Create new test history entry specifically for grammar tests
    const grammarTestResult = new TestHistory({
      studentId,
      subject: 'grammar', // Use 'grammar' as the subject for grammar tests
      stage: '1', // Default values for compatibility
      level: '1',
      score,
      questions: questions.map(q => ({
        text: q.text,
        selectedOption: q.selectedOption || '',
        correctOption: q.correctOption,
        isCorrect: q.isCorrect,
        timeSpent: q.timeSpent || 0,
        allocatedTime: q.allocatedTime || 60,
        explanation: q.explanation || 'No explanation available',
        topicNumber: q.topicNumber,
        difficulty: q.difficulty,
        category: q.category,
        grammarRule: q.grammarRule,
        questionId: q.questionId
      })),
      totalTime,
      passedLevel: score >= 70, // 70% passing threshold for grammar tests
      date: new Date(),
      // Grammar-specific fields
      testMode: testMode || 'grammar_practice',
      topicNumber: topicNumber,
      timingDetails: timingDetails || {},
      performanceMetrics: performanceMetrics || {}
    });
    
    console.log('Saving grammar test result with ID:', grammarTestResult._id);
    await grammarTestResult.save();
    console.log('Grammar test result saved successfully');
    
    // Return the created test history object
    res.status(201).json({
      _id: grammarTestResult._id,
      studentId: grammarTestResult.studentId,
      subject: grammarTestResult.subject,
      module: module,
      topicNumber: grammarTestResult.topicNumber,
      score: grammarTestResult.score,
      questions: grammarTestResult.questions,
      totalTime: grammarTestResult.totalTime,
      passedLevel: grammarTestResult.passedLevel,
      date: grammarTestResult.date,
      performanceMetrics: grammarTestResult.performanceMetrics
    });
  } catch (error) {
    console.error('Error saving grammar test history:', error);
    res.status(500).json({ 
      message: 'Failed to save grammar test results',
      error: error.message,
      details: error.stack
    });
  }
});

// Get all test history for a student as a raw array
app.get('/student/all-test-history', authenticateToken, studentOnly, async (req, res) => {
  try {
    // Use provided studentId if available, otherwise use the token's ID
    const studentId = req.query.studentId || req.user.userId || req.user.id;
    const { batchSize = 20, page = 1, includeDetails = false } = req.query;
    
    console.log('Fetching test history for student ID:', studentId);
    console.log('User info from token:', {
      userId: req.user.userId,
      id: req.user.id,
      username: req.user.username
    });
    
    // Check if the student exists in the database with detailed logging
    let studentInfo = null;
    try {
      // First try to find by direct ID
      studentInfo = await Student.findById(studentId).lean();
      console.log('Student lookup by ID result:', studentInfo ? 'Found' : 'Not found');
      
      if (!studentInfo) {
        // Try to find by studentId field
        studentInfo = await Student.findOne({ studentId }).lean();
        console.log('Student lookup by studentId field result:', studentInfo ? 'Found' : 'Not found');
      }
      
      if (!studentInfo) {
        // Try to find by username if can't find by ID
        const user = await User.findById(studentId).lean();
        if (user) {
          console.log('Found user by ID:', user.username);
          studentInfo = await Student.findOne({ username: user.username }).lean();
          console.log('Student lookup by username result:', studentInfo ? 'Found' : 'Not found');
        }
      }
      
      // If still no student info, create basic info from token
      if (!studentInfo && req.user) {
        console.log('Creating basic student info from token');
        studentInfo = {
          _id: req.user.userId || req.user.id,
          name: req.user.username || 'Student',
          studentId: req.user.userId || req.user.id,
          username: req.user.username
        };
      }
      
      if (studentInfo) {
        console.log(`Using student info: ${studentInfo.name} (ID: ${studentInfo.studentId || studentInfo._id})`);
      } else {
        console.log(`No student record found for ID: ${studentId}`);
      }
    } catch (err) {
      console.error('Error finding student:', err);
    }
    
    // Create the base query
    let query = TestHistory.find({ studentId })
      .sort({ date: -1 }); // Sort by date descending (newest first)
    
    // Get total count for pagination info
    const totalCount = await TestHistory.countDocuments({ studentId });
    console.log(`Found ${totalCount} total test history records for student ${studentId}`);
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(batchSize);
    const limit = parseInt(batchSize);
    
    // Apply pagination
    query = query.skip(skip).limit(limit);
    
    // Execute the query
    const testHistory = await query.lean();
    console.log(`Fetched ${testHistory.length} test history records after pagination`);
    
    // Transform each test for the history table format with enhanced details
    const formattedTests = testHistory.map(test => {
      // Always attach student info to each test record
      if (studentInfo) {
        // Direct student data assignment from our reliable source
        test.studentInfo = {
          name: studentInfo.name || 'Unknown',
          studentId: studentInfo.studentId || studentInfo._id || 'N/A',
          username: studentInfo.username || '',
          _id: studentInfo._id || studentId
        };
        
        // Also ensure the studentId field has the right info if it's used by frontend
        if (typeof test.studentId === 'string') {
          // If it's just a string ID, replace with full object
          test.studentId = {
            _id: studentInfo._id || studentId,
            name: studentInfo.name || 'Unknown',
            studentId: studentInfo.studentId || studentInfo._id || 'N/A',
            username: studentInfo.username || ''
          };
        }
      }
      
      // Continue with performance metrics processing
      const correctAnswers = test.questions?.filter(q => q.isCorrect)?.length || 0;
      const totalQuestions = test.questions?.length || 0;
      
      // ... continue with the rest of the performance metrics ...
      // ... rest of the function remains the same ...
      
      return test;
    });
    
    // Update the function that processes test history to ensure scores are calculated correctly
    const processTestHistory = (test) => {
      // Calculate score if it's zero or missing
      if (test.score === 0 || test.score === undefined) {
        if (test.questions && test.questions.length > 0) {
          const correctCount = test.questions.filter(q => q.isCorrect).length;
          const totalQuestions = test.questions.length;
          
          if (totalQuestions > 0) {
            test.score = Math.round((correctCount / totalQuestions) * 100);
            console.log(`Recalculated score for test ${test._id}: ${test.score}% (${correctCount}/${totalQuestions} correct)`);
          }
        }
      }
      
      return test;
    };
    
    // Update in the /student/all-test-history endpoint
    // Inside the endpoint, before returning the formattedTests:
    formattedTests.forEach(test => {
      processTestHistory(test);
    });
    
    console.log(`Returning ${formattedTests.length} formatted test history records with processed scores`);
    return res.json(formattedTests);
  } catch (error) {
    console.error('Error fetching test history:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper function to get subject name
function getSubjectName(subjectId) {
  const subjects = {
    physics: 'Physics',
    chemistry: 'Chemistry',
    biology: 'Biology'
  };
  
  return subjects[subjectId] || subjectId;
}

// Image upload endpoint for questions
app.post('/admin/upload-image', authenticateToken, adminOnly, upload.single('image'), async (req, res) => {
  try {
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
app.post('/admin/update-points', authenticateToken, adminOnly, async (req, res) => {
  try {
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
        
        // Biology points
        if (student.subjects.biology) {
          const level = parseInt(student.subjects.biology.level) || 1;
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
app.get('/admin/leaderboard', authenticateToken, adminOnly, async (req, res) => {
  try {
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
app.get('/student/leaderboard', authenticateToken, studentOnly, async (req, res) => {
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
        const subjects = student.subjects;
        
        // Convert level strings to numbers and subtract 1 (since level 1 means 0 levels cleared)
        const physicsLevel = parseInt(subjects.physics?.level || '1') - 1;
        const chemistryLevel = parseInt(subjects.chemistry?.level || '1') - 1;
        const biologyLevel = parseInt(subjects.biology?.level || '1') - 1;
        
        // Sum up the levels cleared (ensure they're not negative)
        totalLevelsCleared = 
          Math.max(0, physicsLevel) + 
          Math.max(0, chemistryLevel) + 
          Math.max(0, biologyLevel);
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
app.get('/admin/students/points', authenticateToken, adminOnly, async (req, res) => {
  try {
    const students = await Student.find({}, '-password').lean();
    
    // Calculate N.POINTS for each student
    const studentsWithPoints = students.map(student => {
      let totalLevelsCleared = 0;
      
      if (student.subjects) {
        const subjects = student.subjects;
        
        // Convert level strings to numbers and subtract 1 (since level 1 means 0 levels cleared)
        const physicsLevel = parseInt(subjects.physics?.level || '1') - 1;
        const chemistryLevel = parseInt(subjects.chemistry?.level || '1') - 1;
        const biologyLevel = parseInt(subjects.biology?.level || '1') - 1;
        
        // Sum up the levels cleared (ensure they're not negative)
        totalLevelsCleared = 
          Math.max(0, physicsLevel) + 
          Math.max(0, chemistryLevel) + 
          Math.max(0, biologyLevel);
      }
      
      // Calculate N.POINTS (25 points per level cleared)
      const nPoints = totalLevelsCleared * 25;
      
      return {
        ...student,
        levelsCleared: totalLevelsCleared,
        nPoints
      };
    });
    
    res.json(studentsWithPoints);
  } catch (error) {
    console.error('Error fetching students with points:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
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
app.post('/student/test/submit', authenticateToken, studentOnly, async (req, res) => {
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
app.get('/admin/institutions', authenticateToken, adminOnly, async (req, res) => {
  try {
    // Find all unique institution values
    const institutions = await Student.distinct('institution');
    
    res.status(200).json(institutions);
  } catch (error) {
    console.error('Error fetching institutions:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get students by institution
app.get('/admin/students/institution/:institution', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { institution } = req.params;
    
    // Find all students from a specific institution
    const students = await Student.find({ institution });
    
    res.status(200).json(students);
  } catch (error) {
    console.error('Error fetching students by institution:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get test history for a specific test
app.get('/student/test-history/:testId', authenticateToken, studentOnly, async (req, res) => {
  try {
    const testId = req.params.testId;
    console.log('Fetching test history for ID:', testId);
    
    const testHistory = await TestHistory.findById(testId).lean();
    
    if (!testHistory) {
      console.log('Test history not found for ID:', testId);
      return res.status(404).json({ message: 'Test history not found' });
    }

    console.log('Found test history:', {
      id: testHistory._id,
      subject: testHistory.subject,
      score: testHistory.score,
      questionsCount: testHistory.questions.length,
      hasExplanations: testHistory.questions.some(q => q.explanation)
    });

    // Calculate correct scores if needed
    if (testHistory.score === 0 || !testHistory.score) {
      if (testHistory.questions && testHistory.questions.length > 0) {
        const correctCount = testHistory.questions.filter(q => q.isCorrect).length;
        const totalQuestions = testHistory.questions.length;
        
        if (totalQuestions > 0) {
          testHistory.score = Math.round((correctCount / totalQuestions) * 100);
          console.log(`Recalculated score to ${testHistory.score}% (${correctCount}/${totalQuestions} correct)`);
        }
      }
    }
    
    // Add user information if available
    try {
      if (testHistory.studentId) {
        const student = await Student.findById(testHistory.studentId).lean();
        if (student) {
          testHistory.studentInfo = {
            name: student.name,
            studentId: student.studentId,
            _id: student._id
          };
          console.log(`Added student info: ${student.name} (${student.studentId})`);
        } else {
          console.log('Student not found for ID:', testHistory.studentId);
        }
      }
    } catch (err) {
      console.error('Error fetching student info:', err);
    }

    // Process explanations to ensure they're properly formatted
    const processedQuestions = testHistory.questions.map(q => {
      // Ensure explanation is a valid string
      let explanation = "No explanation available for this question.";
      if (q.explanation && typeof q.explanation === 'string' && q.explanation.trim() !== '' && 
          q.explanation !== 'undefined' && q.explanation !== 'null') {
        explanation = q.explanation;
      }
      
      return {
        text: q.text,
        selectedOption: q.selectedOption,
        correctOption: q.correctOption,
        isCorrect: q.isCorrect,
        timeSpent: q.timeSpent,
        allocatedTime: q.allocatedTime || 60,
        explanation: explanation
      };
    });
    
    testHistory.questions = processedQuestions;
    
    res.json(testHistory);
  } catch (error) {
    console.error('Error fetching test details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Simple test-completion level update - most direct approach for level updates
app.post('/student/test-completion-level-update', authenticateToken, studentOnly, async (req, res) => {
  try {
    console.log('\n\n======= SIMPLE TEST COMPLETION LEVEL UPDATE =======');
    console.log('User token data:', req.user);
    console.log('Request body:', req.body);
    
    const { subject, currentLevel, currentStage, testId } = req.body;
    
    if (!subject) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing subject name' 
      });
    }
    
    // Get student ID from token
    const studentId = req.user.userId;
    const username = req.user.username;
    
    if (!studentId) {
      return res.status(400).json({ 
        success: false,
        message: 'Student ID not found in token' 
      });
    }
    
    console.log('Finding student with ID:', studentId, 'Username:', username);
    
    // Find student document using multiple methods to ensure success
    let student = null;
    
    // Try methods sequentially until one works
    
    // Method 1: Find by ID
    try {
      student = await Student.findById(studentId);
      if (student) {
        console.log('Found student by ID');
      }
    } catch (idError) {
      console.error('Error finding student by ID:', idError.message);
    }
    
    // Method 2: Find by username
    if (!student && username) {
      try {
        student = await Student.findOne({ username: username });
        if (student) {
          console.log('Found student by username');
        }
      } catch (usernameError) {
        console.error('Error finding student by username:', usernameError.message);
      }
    }
    
    // Method 3: Use direct MongoDB query
    if (!student) {
      try {
        const db = mongoose.connection.db;
        const studentsCollection = db.collection('students');
        
        // Find with any field that might match
        const queryConditions = [];
        
        if (mongoose.Types.ObjectId.isValid(studentId)) {
          queryConditions.push({ _id: new mongoose.Types.ObjectId(studentId) });
        }
        
        if (username) {
          queryConditions.push({ username: username });
        }
        
        const rawStudent = await studentsCollection.findOne({ $or: queryConditions });
        
        if (rawStudent) {
          console.log('Found student via direct MongoDB query');
          student = rawStudent;
        }
      } catch (directError) {
        console.error('Error with direct MongoDB query:', directError.message);
      }
    }
    
    if (!student) {
      console.error('Student not found with ID:', studentId, 'or username:', username);
      return res.status(404).json({ 
        success: false,
        message: 'Student not found' 
      });
    }
    
    console.log('Found student:', student.name || student.username);
    
    // Ensure subjects object exists
    if (!student.subjects) {
      student.subjects = {};
    }
    
    // Normalize subject name
    const subjectKey = subject.toLowerCase();
    const capitalizedKey = subjectKey.charAt(0).toUpperCase() + subjectKey.slice(1);
    
    // Get current level info (or initialize if not set)
    if (!student.subjects[subjectKey]) {
      student.subjects[subjectKey] = { level: '1', stage: '1' };
    }
    
    // Read the current level from the database (don't trust the client input)
    const dbLevel = parseInt(student.subjects[subjectKey]?.level || 1);
    const dbStage = parseInt(student.subjects[subjectKey]?.stage || 1);
    
    console.log('Current level in database:', dbLevel);
    console.log('Current stage in database:', dbStage);
    
    // Calculate new level
    let newLevel = dbLevel + 1;
    let newStage = dbStage;
    
    // If level exceeds 4, move to next stage
    if (newLevel > 4) {
      newLevel = 1;
      newStage += 1;
    }
    
    console.log(`Updating ${subject} from Level ${dbLevel}, Stage ${dbStage} to Level ${newLevel}, Stage ${newStage}`);
    
    try {
      // Use reliable direct MongoDB update to avoid schema validation issues
      const db = mongoose.connection.db;
      const result = await db.collection('students').updateOne(
        { _id: student._id },
        { 
          $set: { 
            [`subjects.${subjectKey}`]: {
              level: newLevel.toString(),
              stage: newStage.toString()
            },
            [`subjects.${capitalizedKey}`]: {
              level: newLevel.toString(),
              stage: newStage.toString()
            } 
          } 
        }
      );
      
      console.log('Direct MongoDB update result:', result.modifiedCount, 'documents modified');
      
      if (result.modifiedCount === 0) {
        // If direct update failed, try mongoose save as fallback
        if (student.save) {
          // Update both lowercase and capitalized versions
          student.subjects[subjectKey] = {
            level: newLevel.toString(),
            stage: newStage.toString()
          };
          
          student.subjects[capitalizedKey] = {
            level: newLevel.toString(),
            stage: newStage.toString()
          };
          
          await student.save();
          console.log('Level update successful with mongoose save!');
        } else {
          throw new Error('Both direct update and mongoose save failed');
        }
      }
    } catch (updateError) {
      console.error('Error updating student:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Error updating level',
        error: updateError.message
      });
    }
    
    console.log('Level update successful!');
    console.log('Updated subjects:', JSON.stringify(student.subjects, null, 2));
    console.log('======= SIMPLE LEVEL UPDATE COMPLETE =======\n\n');
    
    res.status(200).json({
      success: true,
      message: 'Level updated successfully',
      subject: subjectKey,
      oldLevel: dbLevel,
      oldStage: dbStage,
      newLevel: newLevel,
      newStage: newStage
    });
    
  } catch (error) {
    console.error('Error in simple test completion level update:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating level',
      error: error.message
    });
  }
});

// Direct level update endpoint for students with high scores (90%+)
app.post('/student/update-level', authenticateToken, studentOnly, async (req, res) => {
  try {
    console.log('\n\n======= DIRECT LEVEL UPDATE REQUEST =======');
    console.log('User:', req.user);
    console.log('Request body:', req.body);
    
    const { subject, newLevel, newStage, testId } = req.body;
    
    if (!subject || !newLevel || !newStage) {
      console.error('Missing required fields:', { subject, newLevel, newStage });
      return res.status(400).json({
        message: 'Missing required fields (subject, newLevel, newStage)',
        received: req.body
      });
    }
    
    // Find the student using username from the token
    const username = req.user.username;
    console.log('Looking for student with username:', username);
    
    let student = await Student.findOne({ username: username });
    if (!student) {
      console.error('Student not found with username:', username);
      
      // Try secondary lookup by ID
      const studentId = req.user.userId || req.user.id;
      console.log('Trying to find by ID instead:', studentId);
      
      if (!studentId) {
        console.error('No student ID available in the token');
        return res.status(404).json({ message: 'Student ID not found in token' });
      }
      
      student = await Student.findById(studentId);
      if (!student) {
        console.error('Student also not found by ID');
        
        // Emergency fallback - try looking up by email
        if (req.user.email) {
          console.log('Trying emergency lookup by email:', req.user.email);
          student = await Student.findOne({ email: req.user.email });
          
          if (!student) {
            console.error('Student not found by email either');
            return res.status(404).json({ message: 'Student not found by any identifier' });
          }
          console.log('Found student by email');
        } else {
          return res.status(404).json({ message: 'Student not found' });
        }
      } else {
        console.log('Student found by ID');
      }
    }
    
    console.log('Found student:', student.name || student.username);
    console.log('Current subjects:', JSON.stringify(student.subjects, null, 2));
    
    // Normalize subject
    const normalizedSubject = subject.toLowerCase();
    console.log('Normalized subject:', normalizedSubject);
    
    // Initialize subjects if needed
    if (!student.subjects) {
      student.subjects = {};
    }
    
    // Update level and stage
    // If the subject doesn't exist yet, create it
    if (!student.subjects[normalizedSubject]) {
      student.subjects[normalizedSubject] = {
        level: '1',
        stage: '1'
      };
    }
    
    // Update values
    student.subjects[normalizedSubject] = {
      level: newLevel,
      stage: newStage
    };
    
    // Also update capitalized version if it exists
    const capitalizedSubject = normalizedSubject.charAt(0).toUpperCase() + normalizedSubject.slice(1);
    student.subjects[capitalizedSubject] = {
      level: newLevel,
      stage: newStage
    };
    
    console.log('Updated subjects (before save):', JSON.stringify(student.subjects, null, 2));
    
    // Save changes to database
    await student.save();
    
    console.log('Student data saved successfully');
    console.log('Final subjects after save:', JSON.stringify(student.subjects, null, 2));
    console.log('======= LEVEL UPDATE COMPLETE =======\n\n');
    
    // Return success response
    res.status(200).json({
      message: 'Level updated successfully',
      subject: normalizedSubject,
      level: newLevel,
      stage: newStage
    });
  } catch (error) {
    console.error('Error in direct level update:', error);
    res.status(500).json({
      message: 'Failed to update level',
      error: error.message
    });
  }
});

// Student endpoint to get topic progress
app.get('/student/topic-progress', authenticateToken, studentOnly, async (req, res) => {
  try {
    // Get student ID from token
    const studentId = req.user.studentId;
    
    // Find the student
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Get topic progress from student document or initialize if not present
    let topicProgress = student.topicProgress || {};
    
    // If no progress yet, initialize with empty objects for each subject
    if (Object.keys(topicProgress).length === 0) {
      topicProgress = {
        'physics': {},
        'chemistry': {},
        'biology': {}
      };
    }
    
    res.json(topicProgress);
  } catch (error) {
    console.error('Error fetching topic progress:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update topic progress after test completion
app.post('/student/update-topic-progress', authenticateToken, studentOnly, async (req, res) => {
  try {
    const { subject, topicNumber, progress, completed, duration } = req.body;
    
    // Validate required fields
    if (!subject || !topicNumber) {
      return res.status(400).json({ message: 'Subject and topic number are required' });
    }
    
    // Get student from token
    const studentId = req.user.studentId;
    const student = await Student.findOne({ studentId });
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Initialize topicProgress if not present
    if (!student.topicProgress) {
      student.topicProgress = {
        'physics': {},
        'chemistry': {},
        'biology': {}
      };
    }
    
    // Initialize subject if not present
    if (!student.topicProgress[subject]) {
      student.topicProgress[subject] = {};
    }
    
    // Get current topic data or initialize
    const currentTopicData = student.topicProgress[subject][topicNumber] || {
      progress: 0,
      completed: false,
      attemptsCount: 0
    };
    
    // Update topic progress
    student.topicProgress[subject][topicNumber] = {
      progress: Math.max(currentTopicData.progress, progress || 0),
      completed: completed || currentTopicData.completed,
      attemptsCount: (currentTopicData.attemptsCount || 0) + 1,
      lastAttemptDate: new Date()
    };
    
    // Save student
    await student.save();
    
    res.status(200).json({
      message: 'Topic progress updated successfully',
      topicProgress: student.topicProgress[subject][topicNumber]
    });
  } catch (error) {
    console.error('Error updating topic progress:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 

// Admin routes for test history
app.get('/admin/test-history', authenticateToken, adminOnly, async (req, res) => {
  try {
    console.log('Admin requesting test history');
    const { studentId } = req.query;
    let query = {};
    
    if (studentId) {
      console.log('Filtering by student ID:', studentId);
      // If studentId is provided, find the matching student
      const student = await Student.findOne({ studentId });
      if (!student) {
        return res.status(404).json({ message: 'Student not found' });
      }
      query.studentId = student._id;
    }
    
    console.log('Fetching test histories with query:', query);
    const testHistories = await TestHistory.find(query)
      .sort({ date: -1 })
      .populate('studentId', 'name username studentId')
      .lean();
    
    console.log(`Found ${testHistories.length} test history records`);
    
    // Add debug output for the first few records
    if (testHistories.length > 0) {
      console.log('Sample test history record:');
      console.log(JSON.stringify({
        _id: testHistories[0]._id,
        studentId: testHistories[0].studentId,
        subject: testHistories[0].subject,
        score: testHistories[0].score
      }, null, 2));
    }
    
    // Ensure studentId data is present
    const enhancedTestHistories = await Promise.all(testHistories.map(async test => {
      // If studentId exists but is not populated correctly
      if (test.studentId && typeof test.studentId === 'string') {
        console.log(`Test ${test._id} has unpopulated studentId: ${test.studentId}`);
        // Manually populate it
        const student = await Student.findById(test.studentId).lean();
        if (student) {
          test.studentId = student;
          console.log(`Populated studentId with student: ${student.name}`);
        }
      }
      return test;
    }));
    
    res.json(enhancedTestHistories);
  } catch (error) {
    console.error('Error fetching test history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get detailed test history for a specific test
app.get('/admin/test-history/:testId', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { testId } = req.params;
    console.log(`Admin requesting detailed test history for ID: ${testId}`);
    
    const testHistory = await TestHistory.findById(testId)
      .populate('studentId', 'name username studentId')
      .populate('questions.questionId')
      .lean();
    
    if (!testHistory) {
      console.log(`Test history not found for ID: ${testId}`);
      return res.status(404).json({ message: 'Test history not found' });
    }
    
    // Ensure studentId is properly populated
    if (testHistory.studentId && typeof testHistory.studentId === 'string') {
      console.log(`Test ${testId} has unpopulated studentId: ${testHistory.studentId}`);
      const student = await Student.findById(testHistory.studentId).lean();
      if (student) {
        testHistory.studentId = student;
        console.log(`Populated studentId with student: ${student.name}`);
      }
    }
    
    // Calculate performance metrics if not present
    if (!testHistory.score || testHistory.score === 0) {
      if (testHistory.questions && testHistory.questions.length > 0) {
        const correctCount = testHistory.questions.filter(q => q.isCorrect).length;
        const totalQuestions = testHistory.questions.length;
        if (correctCount > 0) {
          const calculatedScore = Math.round((correctCount / totalQuestions) * 100);
          console.log(`Recalculated score from ${testHistory.score} to ${calculatedScore}%`);
          testHistory.score = calculatedScore;
        }
      }
    }
    
    console.log(`Returning test history with score: ${testHistory.score}%`);
    res.json(testHistory);
  } catch (error) {
    console.error('Error fetching test history details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a new endpoint to get student profile info
app.get('/student/profile', authenticateToken, studentOnly, async (req, res) => {
  try {
    console.log('Fetching student profile for user:', req.user.userId);
    
    // Try to find the student directly
    let student = await Student.findById(req.user.userId).lean();
    
    // If not found by ID, try by studentId field
    if (!student) {
      student = await Student.findOne({ studentId: req.user.userId }).lean();
      console.log('Student lookup by studentId field result:', student ? 'Found' : 'Not found');
    }
    
    // If still not found, try by username
    if (!student) {
      student = await Student.findOne({ username: req.user.username }).lean();
      console.log('Student lookup by username result:', student ? 'Found' : 'Not found');
    }
    
    // If still no student record, create a temporary one from token
    if (!student) {
      console.log('No student record found, creating one from token');
      student = {
        _id: req.user.userId,
        name: req.user.username || 'Student',
        studentId: req.user.userId,
        username: req.user.username
      };
    }
    
    console.log('Returning student profile:', {
      id: student._id,
      name: student.name,
      studentId: student.studentId
    });
    
    res.json(student);
  } catch (error) {
    console.error('Error fetching student profile:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});