const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  subject: { 
    type: String, 
    required: true,
    enum: ['physics', 'chemistry', 'biology']
  },
  topicNumber: { 
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
    required: true 
  },
  explanation: { 
    type: String,
    default: ''
  },
  difficulty: { 
    type: String, 
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  imageUrl: {
    type: String,
    default: ''
  },
  timeAllocation: {
    type: Number,
    default: 60
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  // Legacy fields for backward compatibility
  stage: { 
    type: String,
    default: '1'
  },
  level: { 
    type: String,
    default: '1'
  },
  topic: {
    type: String,
    default: ''
  }
});

module.exports = mongoose.model('Question', questionSchema); 