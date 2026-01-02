const express = require('express');
const path = require('path');
const { createClient } = require("@supabase/supabase-js");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 1. Config
app.get('/api/config', (req, res) => res.json({ status: "Online", mode: "CAD" }));

// 2. GET MAP DATA (Officers & Active Ops)
app.get('/api/map-data', async (req, res) => {
    const { data: officers } = await supabase.from('officers').select('*');
    const { data: ops } = await supabase.from('operations').select('*').eq('status', 'Active');
    res.json({ officers, ops });
});

// 3. INTERNAL RADIO (Send & Receive)
app.get('/api/radio', async (req, res) => {
    const { data } = await supabase.from('radio_logs').select('*').order('created_at', { ascending: false }).limit(50);
    res.json(data);
});
app.post('/api/radio', async (req, res) => {
    const { sender, message, channel } = req.body;
    const { error } = await supabase.from('radio_logs').insert([{ sender, message, channel }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ status: 'sent' });
});

// 4. OPERATIONS (Submit Report)
app.post('/api/operations', async (req, res) => {
    const { type, subtype, location, details, officer_name } = req.body;
    const { error } = await supabase.from('operations').insert([{ type, subtype, location, details, officer_name }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ status: 'reported' });
});

// 5. TIMESHEETS (Clock In/Out)
app.post('/api/clock', async (req, res) => {
    const { action, officer_name } = req.body; // action: 'in' or 'out'
    if (action === 'in') {
        await supabase.from('timesheets').insert([{ officer_name, clock_in: new Date() }]);
    } else {
        // Simple logic: update last open record
        await supabase.from('timesheets').update({ clock_out: new Date() })
            .eq('officer_name', officer_name).is('clock_out', null);
    }
    res.json({ status: 'success' });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`✅ Evidentia CAD Active on port ${PORT}`));
