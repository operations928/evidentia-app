const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// --- 1. SOCKET.IO (Radio & Tracking) ---
// Store active officers in memory for the live map
let activeUnits = {};

io.on('connection', (socket) => {
    console.log('Unit connected:', socket.id);

    // A. Live Tracking: Receive GPS from officer, update map for everyone
    socket.on('location-update', (data) => {
        activeUnits[socket.id] = data; // data = { name, lat, lng, status }
        io.emit('map-update', Object.values(activeUnits));
    });

    // B. Radio: Receive voice blob, broadcast to everyone else
    socket.on('radio-voice', (audioBuffer) => {
        // Broadcast to everyone EXCEPT sender (so you don't hear yourself echo)
        socket.broadcast.emit('radio-playback', audioBuffer);
    });

    // C. Remove unit on disconnect
    socket.on('disconnect', () => {
        delete activeUnits[socket.id];
        io.emit('map-update', Object.values(activeUnits));
    });
});

// --- 2. API ROUTES (Database) ---
app.post('/api/operations', async (req, res) => {
    const { type, subtype, location, details } = req.body;
    const { error } = await supabase.from('operations').insert([{ type, subtype, location, details }]);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ status: 'ok' });
});

app.post('/api/clock', async (req, res) => {
    const { action, officer_name } = req.body;
    if (action === 'in') {
        await supabase.from('timesheets').insert([{ officer_name, clock_in: new Date() }]);
    } else {
        await supabase.from('timesheets').update({ clock_out: new Date() })
            .eq('officer_name', officer_name).is('clock_out', null);
    }
    res.json({ status: 'ok' });
});

// Serve UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server (using http server for socket.io)
server.listen(PORT, () => {
    console.log(`✅ Evidentia Live Command on port ${PORT}`);
});
