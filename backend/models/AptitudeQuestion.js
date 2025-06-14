const mongoose = require('mongoose');

const aptitudeQuestionSchema = new mongoose.Schema({
  category: { 
    type: String, 
    required: true,
    enum: ['quantitative', 'logical', 'verbal']
  },
  grade: { 
    type: String, 
    required: true,
    enum: ['11', '12']
  },
  difficulty: { 
    type: String, 
    required: true,
    enum: ['easy', 'medium', 'hard']
  },
  topic: {
    type: String,
    required: true
  },
  questionText: { 
    type: String, 
    required: true 
  },
  options: [{ 
    type: String, 
    required: true 
  }],
  correctOption: { 
    type: Number, 
    required: true,
    min: 0,
    max: 3
  },
  explanation: { 
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    default: ''
  },
  timeAllocation: {
    type: Number,
    default: 60,
    min: 30,
    max: 300
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Create index for efficient querying
aptitudeQuestionSchema.index({ category: 1, grade: 1, difficulty: 1, topic: 1 });

module.exports = mongoose.model('AptitudeQuestion', aptitudeQuestionSchema); 