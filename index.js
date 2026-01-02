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

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
let activeUnits = {}; 

// --- SOCKET.IO (Real-time Radio & Map) ---
io.on('connection', (socket) => {
    // 1. UNIT LOGIN
    socket.on('unit-login', (data) => {
        activeUnits[socket.id] = { ...data, socketId: socket.id };
        io.emit('map-update', Object.values(activeUnits));
    });

    // 2. GPS TRACKING
    socket.on('location-update', (data) => {
        if (activeUnits[socket.id]) {
            Object.assign(activeUnits[socket.id], data);
            io.emit('map-update', Object.values(activeUnits));
        }
    });

    // 3. RADIO COMMS
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

// 1. DYNAMIC CONFIG
app.get('/api/config/:key', async (req, res) => {
    const { data } = await supabase.from('app_config').select('value').eq('key', req.params.key).single();
    // Return empty array if no config found, prevents crash
    res.json(data ? data.value : []);
});

app.post('/api/config', async (req, res) => {
    const { key, value } = req.body;
    const { error } = await supabase.from('app_config').upsert([{ key, value }]);
    if(error) return res.status(500).json({error: error.message});
    res.json({status: 'updated'});
});

// 2. COURSES (LMS)
app.get('/api/courses', async (req, res) => {
    const { data } = await supabase.from('courses').select('*');
    res.json(data || []);
});

app.post('/api/courses', async (req, res) => {
    const { title, description, url, role, creator_id } = req.body;
    const { error } = await supabase.from('courses').insert([{ title, description, content_url: url, required_role: role, created_by: creator_id }]);
    if(error) return res.status(500).json({error: error.message});
    res.json({status: 'created'});
});

// 3. LICENSES (HR)
app.get('/api/licenses/:uid', async (req, res) => {
    const { data } = await supabase.from('licenses').select('*').eq('user_id', req.params.uid);
    res.json(data || []);
});

app.post('/api/licenses', async (req, res) => {
    const { user_id, type, number, expiry } = req.body;
    const { error } = await supabase.from('licenses').insert([{ user_id, type, id_number: number, expiry_date: expiry }]);
    if(error) return res.status(500).json({error: error.message});
    res.json({status: 'added'});
});

// 4. CLOCK IN & REPORTS
app.post('/api/clock', async (req, res) => {
    const { action, officer_name, role, lat, lng } = req.body;
    if (action === 'in') await supabase.from('timesheets').insert([{ officer_name, role_worked: role, lat, lng, clock_in: new Date() }]);
    else await supabase.from('timesheets').update({ clock_out: new Date() }).eq('officer_name', officer_name).is('clock_out', null);
    res.json({ status: 'success' });
});

app.post('/api/reports', async (req, res) => {
    const { officer_name, type, location, narrative } = req.body;
    const { error } = await supabase.from('field_reports').insert([{ officer_name, incident_type: type, location, narrative }]);
    res.json({ status: error ? 'error' : 'submitted' });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

server.listen(PORT, () => console.log(`✅ Evidentia Backend Active on port ${PORT}`));
