const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static('public')); 
app.use(express.json());

// 1. Config Endpoint
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_KEY
    });
});

// 2. Chat Endpoint (Using the reliable Gemini 1.5 Flash model)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/chat', async (req, res) => {
    try {
        // Updated model to prevent 500 errors
        const model = genAI.getGenerativeModel({ model: "gemini-pro"});
        
        const prompt = `You are a helpful Security Operations assistant for Evidentia Security. 
                        Keep answers concise and professional. 
                        User asks: ${req.body.message}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        res.json({ reply: text });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: error.message || "AI Error" });
    }
});

// 3. THE FIX: Serve the HTML Dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ Evidentia App is running on port ${PORT}`);
    });
}

module.exports = app;

