const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  studentId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true },
  institution: { type: String, default: 'Default Institution' },
  subjects: {
    physics: {
      level: { type: String, default: '1' },
      stage: { type: String, default: '1' }
    },
    chemistry: {
      level: { type: String, default: '1' },
      stage: { type: String, default: '1' }
    },
    botany: {
      level: { type: String, default: '1' },
      stage: { type: String, default: '1' }
    },
    zoology: {
      level: { type: String, default: '1' },
      stage: { type: String, default: '1' }
    }
  },
  column1: { type: String },
  column2: { type: String },
  column3: { type: String },
  column4: { type: String },
  column5: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Student', studentSchema); 