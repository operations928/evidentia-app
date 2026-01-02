const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// 1. Hub Config Endpoint
app.get('/api/config', (req, res) => {
    res.json({ status: "Online", mode: "Hub" });
});

// 2. Chat Endpoint (Using the specific legacy model name)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/chat', async (req, res) => {
    try {
        // FIX: Use 'gemini-1.0-pro' which is the specific version for the v1beta API
        // The classic model that works on all library versions
const model = genAI.getGenerativeModel({ model: "gemini-pro"});
        
        const prompt = `You are a security operations AI. Keep answers concise. User: ${req.body.message}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        res.json({ reply: text });
        
    } catch (error) {
        console.error("AI Error:", error.message);
        res.json({ reply: "⚠️ AI Error: " + error.message });
    }
});

// 3. Mock Data for the Hub (Live Incidents)
app.get('/api/incidents', (req, res) => {
    res.json([
        { id: 101, type: "Unauthorized Access", location: "Server-DB-04", status: "Critical" },
        { id: 102, type: "Malware Detected", location: "Workstation-22", status: "Resolved" },
        { id: 103, type: "Port Scan", location: "Gateway-North", status: "Monitoring" }
    ]);
});

// 4. Serve the Hub UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ Hub Active on port ${PORT}`);
    });
}
module.exports = app;
