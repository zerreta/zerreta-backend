const mongoose = require('mongoose');

const grammarQuestionSchema = new mongoose.Schema({
  module: { 
    type: String, 
    required: true,
    enum: ['beginner', 'basic', 'intermediate', 'advanced']
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
  grammarRule: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    enum: ['tenses', 'articles', 'prepositions', 'modal-verbs', 'conditionals', 'passive-voice', 'reported-speech', 'relative-clauses', 'conjunctions', 'phrasal-verbs', 'others'],
    default: 'others'
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('GrammarQuestion', grammarQuestionSchema); 