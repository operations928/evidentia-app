const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();

// Hostinger (and most VPS) will assign a port via process.env.PORT.
// If not found, it defaults to 3000.
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// 1. Endpoint to safely send Supabase config to the frontend
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_KEY
    });
});

// 2. Endpoint for Gemini AI (Chatbot)
// Note: Ensure GEMINI_API_KEY is set in your Hostinger Environment Variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/chat', async (req, res) => {
    try {
        // Use the newer, faster, and more stable model const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
        const prompt = `You are a helpful Security Operations assistant for Evidentia Security. 
                        Keep answers concise and professional. 
                        User asks: ${req.body.message}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        res.json({ reply: text });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: "Failed to fetch AI response." });
    }
});

// 3. Serve the Dashboard (Frontend)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server - SIMPLIFIED FOR HOSTINGER
// We removed the "module.exports" and the "if" check because Hostinger
// always wants this file to start the server immediately.
app.listen(PORT, () => {
    console.log(`✅ Evidentia App is running on port ${PORT}`);
});
