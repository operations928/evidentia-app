const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// 1. Config Endpoint
app.get('/api/config', (req, res) => {
    res.json({ status: "Online", mode: "Hub" });
});

// 2. Chat Endpoint (Now using the faster Flash model supported by the new library)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/chat', async (req, res) => {
    try {
        // With the library update, this model will now work reliably
        // The classic model that works on all library versions
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "YAIzaSyDPT7e9_1uExRUrb4LN1Z0kmryTRqeIvgY" });

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Explain how AI works in a few words",
  });
  console.log(response.text);
}

main();
        
        const prompt = `You are a security operations AI for Evidentia. Keep answers concise and professional. User: ${req.body.message}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        res.json({ reply: text });
        
    } catch (error) {
        console.error("AI Error:", error.message);
        res.json({ reply: "⚠️ AI Offline: " + error.message });
    }
});

// 3. Hub Data Endpoint (Mock Data for the Dashboard)
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



