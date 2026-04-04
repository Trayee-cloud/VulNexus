const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    domain: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, default: "" },
    url: { type: String, default: "" },
    description: { type: String, required: true },
    impact: { type: String, default: "" },
    bugType: { type: String, default: "N/A" },
    severity: { type: String, default: "N/A" },
    poc: { type: String, default: "N/A" },
    bountyEligible: { type: Boolean, default: false },
    submissionType: { type: String, enum: ['vuln', 'bounty'], default: 'vuln' },
    status: { type: String, default: "Open" },
    reward: { type: String, default: "$0" },
    date: { type: String, default: () => new Date().toLocaleString() }
}, { 
    collection: 'reports', // Force collection name to be "reports"
    timestamps: false      // We are managing `date` manually based on previous code
});

module.exports = mongoose.model('Report', reportSchema);