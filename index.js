const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 5e7 }); // 50MB buffer
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
        io.emit('unit-status-change', Object.values(activeUnits)); // Update Command View
    });

    // 2. GPS
    socket.on('location-update', (data) => {
        if (activeUnits[socket.id]) {
            Object.assign(activeUnits[socket.id], data);
            io.emit('map-update', Object.values(activeUnits));
        }
    });

    // 3. RADIO (Save to DB + Broadcast)
    socket.on('radio-voice', async (data) => {
        socket.broadcast.emit('radio-playback', data);
        // Save to DB so it can be replayed later
        await supabase.from('radio_logs').insert([{ 
            sender: data.name, message: '[AUDIO TRANSMISSION]', is_voice: true, 
            audio_data: data.audio, lat: data.lat, lng: data.lng 
        }]);
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

// 1. DATA FETCHING (For Session Restore & Lists)
app.get('/api/radio-history', async (req, res) => {
    // Fetch last 50 messages for the chat window
    const { data } = await supabase.from('radio_logs').select('*').order('created_at', { ascending: false }).limit(50);
    res.json(data ? data.reverse() : []);
});

// 2. CLIENTS & TICKETS (CRM)
app.get('/api/clients', async (req, res) => {
    const { data } = await supabase.from('clients').select('*');
    res.json(data || []);
});
app.post('/api/clients', async (req, res) => {
    const { name, address, phone } = req.body;
    const { error } = await supabase.from('clients').insert([{ name, address, phone }]);
    res.json({ status: error ? 'error' : 'ok' });
});

app.get('/api/tickets', async (req, res) => {
    // Join with clients to get names
    const { data } = await supabase.from('tickets').select('*, clients(name), profiles(full_name)');
    res.json(data || []);
});
app.post('/api/tickets', async (req, res) => {
    const { client_id, type, priority, description } = req.body;
    const { error } = await supabase.from('tickets').insert([{ client_id, type, priority, description }]);
    res.json({ status: error ? 'error' : 'ok' });
});

// 3. STAFF MANAGEMENT (Command Only)
app.get('/api/staff', async (req, res) => {
    const { data } = await supabase.from('profiles').select('*');
    res.json(data || []);
});
app.post('/api/staff/update', async (req, res) => {
    const { id, role, rank, team } = req.body;
    const { error } = await supabase.from('profiles').update({ role, rank, team }).eq('id', id);
    res.json({ status: error ? 'error' : 'updated' });
});

// 4. PROFILE UPDATE
app.post('/api/profile/update', async (req, res) => {
    const { id, updates } = req.body; // updates is an object of fields
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    res.json({ status: error ? 'error' : 'updated' });
});

// 5. EXISTING ENDPOINTS
app.get('/api/config/:key', async (req, res) => {
    const { data } = await supabase.from('app_config').select('value').eq('key', req.params.key).single();
    res.json(data ? data.value : []);
});
app.post('/api/clock', async (req, res) => {
    const { action, officer_name, role, lat, lng } = req.body;
    if (action === 'in') await supabase.from('timesheets').insert([{ officer_name, role_worked: role, lat, lng, clock_in: new Date() }]);
    else await supabase.from('timesheets').update({ clock_out: new Date() }).eq('officer_name', officer_name).is('clock_out', null);
    res.json({ status: 'success' });
});
app.get('/api/stats/:name', async (req, res) => {
    const name = req.params.name;
    const { count } = await supabase.from('field_reports').select('*', { count: 'exact' }).eq('officer_name', name);
    const { data: sheets } = await supabase.from('timesheets').select('*').eq('officer_name', name).not('clock_out', 'is', null);
    let total = 0;
    if(sheets) sheets.forEach(s => total += (new Date(s.clock_out) - new Date(s.clock_in)) / 36e5);
    res.json({ reports: count || 0, hours: total.toFixed(1) });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
server.listen(PORT, () => console.log(`✅ Evidentia TOC Active on port ${PORT}`));
