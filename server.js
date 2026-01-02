const express = require('express');
const path = require('path');
// NEW SDK IMPORT
const { GoogleGenAI } = require("@google/genai");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// 1. Config Endpoint
app.get('/api/config', (req, res) => {
    res.json({ status: "Online", mode: "Hub" });
});

// 2. Chat Endpoint (Using GEMINI 2.5 FLASH)
// Initialize with the new SDK format
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/chat', async (req, res) => {
    try {
        // NEW SDK SYNTAX:
        // 1. Use 'ai.models.generateContent'
        // 2. Pass an object with 'model' and 'contents'
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `You are a security operations AI for Evidentia. Concise answers. User: ${req.body.message}`
        });

        // The new SDK returns text via the .text property (not a function)
        const text = response.text; 
        
        res.json({ reply: text });
        
    } catch (error) {
        console.error("AI Error:", error.message);
        res.json({ reply: "⚠️ AI Offline: " + error.message });
    }
});

// 3. Hub Data Endpoint
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

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ Hub Active on port ${PORT}`);
    });
}
module.exports = app;
