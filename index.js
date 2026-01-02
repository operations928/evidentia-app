const express = require('express');
const path = require('path');
const { GoogleGenAI } = require("@google/genai");
const { createClient } = require("@supabase/supabase-js");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Initialize AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 1. Config Endpoint
app.get('/api/config', (req, res) => {
    res.json({ status: "Online", mode: "Hub" });
});

// 2. Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: `You are a security operations AI for Evidentia. Concise answers. User: ${req.body.message}`
        });
        res.json({ reply: response.text });
    } catch (error) {
        console.error("AI Error:", error.message);
        res.json({ reply: "⚠️ AI Offline: " + error.message });
    }
});

// 3. GET Incidents (Real Data from Supabase)
app.get('/api/incidents', async (req, res) => {
    const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// 4. POST New Incident (Report from Dashboard)
app.post('/api/incidents', async (req, res) => {
    const { type, location, status } = req.body;
    const { data, error } = await supabase
        .from('incidents')
        .insert([{ type, location, status }])
        .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Serve UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ Hub Active on port ${PORT}`);
    });
}
module.exports = app;
