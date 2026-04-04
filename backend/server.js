// ============================================================
//  Vulnexus – Bug Bounty Portal Backend
//  Server: Express  |  Port: 5000
//  Storage: MongoDB (Mongoose)
// ============================================================

const express = require("express");
const cors    = require("cors");
const mongoose = require("mongoose");
const path = require("path");

// Try to load .env from the backend directory first, then fallback to root directory
require("dotenv").config(); 
require("dotenv").config({ path: path.resolve(__dirname, '../.env') });

const Report = require("./models/Report");

const app  = express();
const PORT = 5000;

// ── Middleware ────────────────────────────────────────────
app.use(cors());               // Allow requests from the frontend (any origin in dev)
app.use(express.json());       // Parse incoming JSON bodies

// ── Database Connection ───────────────────────────────────
// Verify that MONGO_URI is set
if (!process.env.MONGO_URI) {
    console.error("❌ ERROR: MONGO_URI is not defined in the .env file format.");
    process.exit(1);
}

// Log connection string (without credentials)
const uri = process.env.MONGO_URI;
try {
    const parsedUri = new URL(uri);
    // Explicitly hide password
    if (parsedUri.password) parsedUri.password = '****';
    console.log(`[MongoDB] Using connection string: ${parsedUri.toString()}`);
} catch (e) {
    console.log(`[MongoDB] Using connection string (could not parse as URL format).`);
}

// Ensure Database name is set. If not already in the connection string we will force it below
mongoose.connect(uri, {
    dbName: 'bugbounty' // This ensures that it explicitly selects 'bugbounty' database
})
.then(async () => {
    console.log("✅ MongoDB successfully connected!");
    console.log(`✅ Using Database: ${mongoose.connection.db.databaseName}`);
    
    // Force Collection Creation (insert test doc if empty)
    try {
        const count = await Report.countDocuments();
        if (count === 0) {
            console.log("⚠️ Collection 'reports' is empty. Inserting a test document to force collection creation...");
            await new Report({
                id: "TEST-0000",
                domain: "test.com",
                name: "Test User",
                description: "This is an automated test document to initialize the database collection.",
                submissionType: "vuln",
                date: new Date().toLocaleString()
            }).save();
            console.log("✅ Test document inserted successfully.");
        }
    } catch (err) {
        console.error("❌ Error checking collection count:", err);
    }
})
.catch(err => {
    console.error("❌ MongoDB connection error:", err);
});

// ── Helper: generate a unique numeric ID ─────────────────
function generateId(isBounty) {
    const prefix = isBounty ? "BBP" : "VULN";
    const num    = Math.floor(1000 + Math.random() * 9000); // 4-digit
    return `${prefix}-${num}`;
}

// ─────────────────────────────────────────────────────────
//  POST /report  –  Submit a new vulnerability / bounty report
// ─────────────────────────────────────────────────────────
app.post("/report", async (req, res) => {
    try {
        const {
            domain,
            name,
            email,
            url,
            description,
            impact,
            bugType,
            severity,
            poc,
            bountyEligible,
            submissionType    // "vuln" | "bounty"
        } = req.body;

        // Basic validation – title / description are required
        if (!name || !description) {
            return res.status(400).json({ error: "Name and description are required." });
        }

        const isBounty = submissionType === "bounty";

        // Auto-assign reward based on severity
        let reward = "$0";
        if (isBounty) {
            if      (severity === "Critical") reward = "$1000+";
            else if (severity === "High")     reward = "$500";
            else if (severity === "Medium")   reward = "$200";
            else if (severity === "Low")      reward = "$50";
        }

        const newReportData = {
            id:             generateId(isBounty),
            domain:         domain   || "Unknown",
            name:           name     || "",
            email:          email    || "",
            url:            url      || "",
            description:    description,
            impact:         impact   || "",
            bugType:        isBounty && bugType  ? bugType  : "N/A",
            severity:       isBounty && severity ? severity : "N/A",
            poc:            isBounty && poc      ? poc      : "N/A",
            bountyEligible: !!(isBounty && bountyEligible),
            submissionType: isBounty ? "bounty" : "vuln",
            status:         "Open",   // default status
            reward:         reward,
            date:           new Date().toLocaleString()
        };

        const newReport = new Report(newReportData);
        await newReport.save();

        console.log(`[POST /report] Saved to MongoDB: ${newReport.id}`);
        return res.status(201).json({ message: "Report submitted successfully!", report: newReportData });
    } catch (error) {
        console.error("[POST /report] Error saving report:", error);
        return res.status(500).json({ error: "Failed to save report to database." });
    }
});

// ─────────────────────────────────────────────────────────
//  GET /reports  –  Fetch all reports
// ─────────────────────────────────────────────────────────
app.get("/reports", async (req, res) => {
    try {
        // Fetch all generic and map fields back. Mongoose returns '_id' implicitly.
        const allReports = await Report.find().lean();
        console.log(`[GET /reports] Returning ${allReports.length} report(s) from MongoDB`);
        
        // Remove MongoDB specific "_id" and "__v" if you want frontend compatibility with original format
        const cleanedReports = allReports.map(r => {
            const { _id, __v, ...rest } = r;
            return rest;
        });

        return res.status(200).json(cleanedReports);
    } catch (error) {
        console.error("[GET /reports] Error fetching reports:", error);
        return res.status(500).json({ error: "Failed to fetch reports." });
    }
});

// ─────────────────────────────────────────────────────────
//  GET /domain-stats  –  Get grouped vulnerabilities per domain
// ─────────────────────────────────────────────────────────
app.get("/domain-stats", async (req, res) => {
    try {
        const stats = await Report.aggregate([
            { $group: { _id: "$domain", count: { $sum: 1 } } }
        ]);
        return res.status(200).json(stats);
    } catch (error) {
        console.error("[GET /domain-stats] Error fetching domain stats:", error);
        return res.status(500).json({ error: "Failed to fetch domain stats." });
    }
});

// ─────────────────────────────────────────────────────────
//  PUT /report/:id  –  Update status and/or reward
// ─────────────────────────────────────────────────────────
app.put("/report/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reward } = req.body;
        
        const updateData = {};
        if (status !== undefined) updateData.status = status;
        if (reward !== undefined) updateData.reward = reward;
        
        const updatedReport = await Report.findOneAndUpdate({ id: id }, updateData, { new: true }).lean();

        if (!updatedReport) {
            return res.status(404).json({ error: `Report with id '${id}' not found.` });
        }

        console.log(`[PUT /report/${id}] Updated in MongoDB → status: ${updatedReport.status}, reward: ${updatedReport.reward}`);
        const { _id, __v, ...rest } = updatedReport;
        return res.status(200).json({ message: "Report updated.", report: rest });
    } catch (error) {
         console.error(`[PUT /report/${req.params.id}] Error updating report:`, error);
         return res.status(500).json({ error: "Failed to update report." });
    }
});

// ─────────────────────────────────────────────────────────
//  DELETE /report/:id  –  Remove a report
// ─────────────────────────────────────────────────────────
app.delete("/report/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const deletedReport = await Report.findOneAndDelete({ id: id });
        
        if (!deletedReport) {
            return res.status(404).json({ error: `Report with id '${id}' not found.` });
        }
        
        console.log(`[DELETE /report/${id}] Deleted from MongoDB`);
        return res.status(200).json({ message: "Report deleted." });
    } catch (error) {
        console.error(`[DELETE /report/${req.params.id}] Error deleting report:`, error);
        return res.status(500).json({ error: "Failed to delete report." });
    }
});

// ─────────────────────────────────────────────────────────
//  Start server
// ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Vulnexus backend running at http://localhost:${PORT}`);
    console.log("   Endpoints:");
    console.log("     POST   /report");
    console.log("     GET    /reports");
    console.log("     PUT    /report/:id");
    console.log("     DELETE /report/:id\n");
});