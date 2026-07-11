const mongoose = require('mongoose');

const knowledgeSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    embedding: { type: [Number], required: true }, // For vector search (Cosine Similarity)
    brandname: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Knowledge', knowledgeSchema);
