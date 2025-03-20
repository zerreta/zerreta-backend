const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  subject: { 
    type: String, 
    required: true,
    enum: ['physics', 'chemistry', 'botany', 'zoology']
  },
  stage: { 
    type: String, 
    required: true 
  },
  level: { 
    type: String, 
    required: true 
  },
  topic: {
    type: String,
    default: ''
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
    type: String 
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
  }
});

module.exports = mongoose.model('Question', questionSchema); 