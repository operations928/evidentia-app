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

// 2. Chat Endpoint (Safe Mode)
// This setup uses 'gemini-pro' which is the standard model.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/chat', async (req, res) => {
    try {
        // FIX: Using 'gemini-pro' to avoid "Not Found" errors
        const model = genAI.getGenerativeModel({ model: "gemini-pro"});

        const prompt = `You are a security assistant. Concise answers only. User: ${req.body.message}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        res.json({ reply: text });

    } catch (error) {
        console.error("AI Error:", error.message);
        
        // CRITICAL FIX: Instead of crashing (500), send the error to the chat
        // This keeps your Hub alive even if Google fails.
        res.json({ 
            reply: "⚠️ AI Connection Error: " + error.message 
        });
    }
});

// 3. Serve the Visual Hub
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
