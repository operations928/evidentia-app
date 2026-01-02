const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 5e7 }); 
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
let activeUnits = {}; 

// --- SOCKET.IO ---
io.on('connection', (socket) => {
    // 1. LOGIN
    socket.on('unit-login', (data) => {
        activeUnits[socket.id] = { ...data, socketId: socket.id };
        io.emit('map-update', Object.values(activeUnits));
    });

    // 2. RADIO VOICE
    socket.on('radio-voice', async (data) => {
        // Broadcast to everyone else (excluding sender)
        socket.broadcast.emit('radio-playback', data);
        
        // Save to DB
        await supabase.from('radio_logs').insert([{ 
            sender: data.name, 
            message: '[AUDIO TRANSMISSION]', 
            is_voice: true, 
            audio_data: data.audio, // Base64 Audio
            lat: data.lat, 
            lng: data.lng 
        }]);
    });
    
    // 3. RADIO TEXT
    socket.on('radio-text', async (data) => {
        io.emit('radio-text-broadcast', data); // Send to everyone including sender
        await supabase.from('radio_logs').insert([{ 
            sender: data.name, 
            message: data.msg, 
            is_voice: false, 
            lat: data.lat, 
            lng: data.lng 
        }]);
    });

    socket.on('disconnect', () => {
        delete activeUnits[socket.id];
        io.emit('map-update', Object.values(activeUnits));
    });
});

// --- API ROUTES ---

// 1. CONFIG (Fixes Report Dropdown)
app.get('/api/config/:key', async (req, res) => {
    const { data } = await supabase.from('app_config').select('value').eq('key', req.params.key).single();
    // Default fallback if DB is empty
    const fallback = ["General Report", "Alarm", "Patrol", "Incident"];
    res.json(data ? data.value : fallback);
});

// 2. PROFILE UPDATE (Fixes Profile Pic)
app.post('/api/profile/update', async (req, res) => {
    const { id, updates } = req.body;
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    res.json({ status: error ? 'error' : 'updated' });
});

// 3. STATS & HISTORY
app.get('/api/radio-history', async (req, res) => {
    const { data } = await supabase.from('radio_logs').select('*').order('created_at', { ascending: false }).limit(20);
    res.json(data ? data.reverse() : []);
});

app.get('/api/stats/:name', async (req, res) => {
    const name = req.params.name;
    const { count } = await supabase.from('field_reports').select('*', { count: 'exact' }).eq('officer_name', name);
    // Simple mock calculation for hours to prevent crash if timesheets empty
    res.json({ reports: count || 0, hours: "0.0" });
});

// 4. CLOCK IN/OUT
app.post('/api/clock', async (req, res) => {
    const { action, officer_name, role, lat, lng } = req.body;
    if (action === 'in') {
        await supabase.from('timesheets').insert([{ officer_name, role_worked: role, lat, lng, clock_in: new Date() }]);
    } else {
        // Close the most recent open shift
        await supabase.from('timesheets')
            .update({ clock_out: new Date() })
            .eq('officer_name', officer_name)
            .is('clock_out', null);
    }
    res.json({ status: 'success' });
});

// 5. GENERIC INSERTS
app.post('/api/reports', async (req, res) => {
    const { officer_name, type, location, narrative } = req.body;
    const { error } = await supabase.from('field_reports').insert([{ officer_name, incident_type: type, location, narrative }]);
    res.json({ status: 'ok' });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
server.listen(PORT, () => console.log(`✅ Evidentia Fixed on port ${PORT}`));
