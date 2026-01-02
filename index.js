const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 1e7 }); 
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json({ limit: '50mb' })); // Increased limit for file uploads

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
let activeUnits = {}; 

// --- SOCKET.IO (Real-time Radio & Map) ---
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

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
        // Broadcast to everyone else
        socket.broadcast.emit('radio-playback', data);
        // Save Log
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

// 1. CONFIG
app.get('/api/config/:key', async (req, res) => {
    const { data } = await supabase.from('app_config').select('value').eq('key', req.params.key).single();
    res.json(data ? data.value : []);
});
app.post('/api/config', async (req, res) => {
    const { key, value } = req.body;
    const { error } = await supabase.from('app_config').upsert([{ key, value }]);
    if(error) return res.status(500).json({error: error.message});
    res.json({status: 'updated'});
});

// 2. COURSES
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

// 3. LICENSES
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

// 4. CLOCK IN/OUT & STATS
app.post('/api/clock', async (req, res) => {
    const { action, officer_name, role, lat, lng } = req.body;
    
    if (action === 'in') {
        const { error } = await supabase.from('timesheets').insert([{ officer_name, role_worked: role, lat, lng, clock_in: new Date() }]);
        if(error) return res.status(500).json({error: error.message});
    } else {
        // Find the last OPEN shift (clock_out is null) for this person
        const { error } = await supabase.from('timesheets')
            .update({ clock_out: new Date() })
            .eq('officer_name', officer_name)
            .is('clock_out', null); // IMPORTANT: Only update open shifts
        
        if(error) return res.status(500).json({error: error.message});
    }
    res.json({ status: 'success' });
});

// Get User Stats (Hours & Reports)
app.get('/api/stats/:name', async (req, res) => {
    const name = req.params.name;
    
    // Get Report Count
    const { count: reportCount } = await supabase.from('field_reports').select('*', { count: 'exact' }).eq('officer_name', name);
    
    // Get Timesheets to calc hours
    const { data: sheets } = await supabase.from('timesheets').select('*').eq('officer_name', name).not('clock_out', 'is', null);
    
    let totalHours = 0;
    if(sheets) {
        sheets.forEach(s => {
            const start = new Date(s.clock_in);
            const end = new Date(s.clock_out);
            const hours = (end - start) / 1000 / 60 / 60;
            totalHours += hours;
        });
    }
    
    res.json({ reports: reportCount || 0, hours: totalHours.toFixed(1) });
});

app.post('/api/reports', async (req, res) => {
    const { officer_name, type, location, narrative } = req.body;
    const { error } = await supabase.from('field_reports').insert([{ officer_name, incident_type: type, location, narrative }]);
    res.json({ status: error ? 'error' : 'submitted' });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

server.listen(PORT, () => console.log(`✅ Evidentia Backend Active on port ${PORT}`));
