const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 }); 
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json({ limit: '10mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
let activeUnits = {}; 

io.on('connection', (socket) => {
    // UNIT LOGIN
    socket.on('unit-login', (data) => {
        activeUnits[socket.id] = { ...data, socketId: socket.id };
        io.emit('map-update', Object.values(activeUnits));
    });

    // GPS TRACKING
    socket.on('location-update', (data) => {
        if (activeUnits[socket.id]) {
            Object.assign(activeUnits[socket.id], data);
            io.emit('map-update', Object.values(activeUnits));
        }
    });

    // RADIO VOICE & TEXT
    socket.on('radio-voice', async (data) => {
        socket.broadcast.emit('radio-playback', data);
        await supabase.from('radio_logs').insert([{ sender: data.name, message: '[AUDIO]', is_voice: true, audio_data: data.audio, lat: data.lat, lng: data.lng }]);
    });
    
    socket.on('radio-text', async (data) => {
        io.emit('radio-text-broadcast', data);
        await supabase.from('radio_logs').insert([{ sender: data.name, message: data.msg, is_voice: false, lat: data.lat, lng: data.lng }]);
    });

    socket.on('disconnect', () => {
        delete activeUnits[socket.id];
        io.emit('map-update', Object.values(activeUnits));
    });
});

// --- API ROUTES ---

// 1. Clock In/Out
app.post('/api/clock', async (req, res) => {
    const { action, officer_name, role, lat, lng } = req.body;
    if (action === 'in') {
        await supabase.from('timesheets').insert([{ officer_name, role_worked: role, lat, lng, clock_in: new Date() }]);
    } else {
        await supabase.from('timesheets').update({ clock_out: new Date() }).eq('officer_name', officer_name).is('clock_out', null);
    }
    res.json({ status: 'success' });
});

// 2. Metrics (Accept/Arrive/Complete)
app.post('/api/metrics', async (req, res) => {
    const { action, call_id, officer_name } = req.body;
    const timestamp = new Date();
    
    if (action === 'accept') await supabase.from('mission_metrics').insert([{ call_id, officer_name, accepted_at: timestamp, en_route_at: timestamp }]);
    else if (action === 'arrive') await supabase.from('mission_metrics').update({ on_scene_at: timestamp }).eq('call_id', call_id).eq('officer_name', officer_name);
    else if (action === 'complete') await supabase.from('mission_metrics').update({ completed_at: timestamp }).eq('call_id', call_id).eq('officer_name', officer_name);
    
    res.json({ status: 'recorded' });
});

// 3. NEW: Submit Field Report
app.post('/api/reports', async (req, res) => {
    const { officer_name, type, location, narrative } = req.body;
    const { error } = await supabase.from('field_reports').insert([{ officer_name, incident_type: type, location, narrative }]);
    if(error) return res.status(500).json({error: error.message});
    res.json({ status: 'submitted' });
});

// 4. DATA FETCHING
app.get('/api/admin/timesheets', async (req, res) => {
    const { data } = await supabase.from('timesheets').select('*').order('clock_in', { ascending: false }).limit(20);
    res.json(data);
});
app.get('/api/admin/reports', async (req, res) => { // New Endpoint for Report Viewer
    const { data } = await supabase.from('field_reports').select('*').order('created_at', { ascending: false }).limit(20);
    res.json(data);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
server.listen(PORT, () => console.log(`✅ Evidentia Ultimate Active on port ${PORT}`));
