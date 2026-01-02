const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static('public')); // This serves your CSS/JS/HTML files
app.use(express.json());

// 1. Endpoint for frontend config
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_KEY
    });
});

// 2. Chat Endpoint (Updated for reliability)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/api/chat', async (req, res) => {
    try {
        // FIX: Switched from 'gemini-pro' to 'gemini-1.5-flash'
        // This model is faster and less likely to throw 500 errors on the free tier.
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash"});
        
        const prompt = `You are a helpful Security Operations assistant for Evidentia Security. 
                        Keep answers concise and professional. 
                        User asks: ${req.body.message}`;
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        res.json({ reply: text });
    } catch (error) {
        console.error("AI Error:", error);
        // This will print the EXACT error to your Render logs if it fails again
        res.status(500).json({ error: error.message || "Failed to fetch AI response." });
    }
});

// 3. Serve the Dashboard (The fix for the "Funny" JSON screen)
app.get('/', (req, res) => {
    // This tells the server: "When someone visits the home page, show them the HTML file, not JSON."
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`✅ Evidentia App is running on port ${PORT}`);
});
