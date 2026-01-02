const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");
require('dotenv').config();

const RateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" }, maxHttpBufferSize: 5e7 }); 
const PORT = process.env.PORT || 3000;

// Rate Limiter
const rootLimiter = RateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100, 
});

app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
let activeUnits = {}; 

// --- SOCKET.IO ---
io.on('connection', (socket) => {
    socket.on('unit-login', (data) => {
        activeUnits[socket.id] = { ...data, socketId: socket.id };
        io.emit('map-update', Object.values(activeUnits));
    });
    socket.on('location-update', (data) => {
        if (activeUnits[socket.id]) {
            Object.assign(activeUnits[socket.id], data);
            io.emit('map-update', Object.values(activeUnits));
        }
    });
    socket.on('radio-voice', async (data) => {
        socket.broadcast.emit('radio-playback', data); 
        await supabase.from('radio_logs').insert([{ 
            sender: data.name, message: '[AUDIO]', is_voice: true, 
            audio_data: data.audio, lat: data.lat, lng: data.lng 
        }]);
    });
    socket.on('radio-text', async (data) => {
        io.emit('radio-text-broadcast', data);
        await supabase.from('radio_logs').insert([{ 
            sender: data.name, message: data.msg, is_voice: false, 
            lat: data.lat, lng: data.lng 
        }]);
    });
    socket.on('disconnect', () => {
        delete activeUnits[socket.id];
        io.emit('map-update', Object.values(activeUnits));
    });
});

// --- API ROUTES (Consolidated) ---

// 1. DATA & CONFIG
app.get('/api/radio-history', async (req, res) => {
    const { data } = await supabase.from('radio_logs').select('*').order('created_at', { ascending: false }).limit(20);
    res.json(data ? data.reverse() : []);
});
app.get('/api/config/:key', async (req, res) => {
    const { data } = await supabase.from('app_config').select('value').eq('key', req.params.key).single();
    res.json(data ? data.value : ["General", "Patrol", "Incident"]);
});
app.post('/api/config', async (req, res) => {
    const { key, value } = req.body;
    await supabase.from('app_config').upsert([{ key, value }]);
    res.json({ status: 'ok' });
});

// 2. PROFILES & STAFF
app.post('/api/profile/update', async (req, res) => {
    const { id, updates } = req.body;
    const { error } = await supabase.from('profiles').update(updates).eq('id', id);
    res.json({ status: error ? 'error' : 'updated' });
});
app.get('/api/staff', async (req, res) => {
    const { data } = await supabase.from('profiles').select('*');
    res.json(data || []);
});
app.get('/api/stats/:name', async (req, res) => {
    const { count } = await supabase.from('field_reports').select('*', { count: 'exact' }).eq('officer_name', req.params.name);
    res.json({ reports: count || 0, hours: "0.0" }); 
});

// 3. CRM & TICKETS
app.get('/api/clients', async (req, res) => {
    const { data } = await supabase.from('clients').select('*');
    res.json(data || []);
});
app.post('/api/clients', async (req, res) => {
    const { name, phone, address } = req.body;
    await supabase.from('clients').insert([{ name, phone, address }]);
    res.json({ status: 'ok' });
});
app.get('/api/tickets', async (req, res) => {
    const { data } = await supabase.from('tickets').select('*, clients(name)');
    res.json(data || []);
});
app.post('/api/tickets', async (req, res) => {
    const { client_id, type, priority, description } = req.body;
    await supabase.from('tickets').insert([{ client_id, type, priority, description }]);
    res.json({ status: 'ok' });
});

// 4. OPS
app.post('/api/clock', async (req, res) => {
    const { action, officer_name, role, lat, lng } = req.body;
    if (action === 'in') await supabase.from('timesheets').insert([{ officer_name, role_worked: role, lat, lng, clock_in: new Date() }]);
    else await supabase.from('timesheets').update({ clock_out: new Date() }).eq('officer_name', officer_name).is('clock_out', null);
    res.json({ status: 'success' });
});
app.post('/api/reports', async (req, res) => {
    const { officer_name, type, location, narrative } = req.body;
    await supabase.from('field_reports').insert([{ officer_name, incident_type: type, location, narrative }]);
    res.json({ status: 'ok' });
});
app.get('/api/licenses/:uid', async (req, res) => {
    const { data } = await supabase.from('licenses').select('*').eq('user_id', req.params.uid);
    res.json(data || []);
});
app.get('/api/courses', async (req, res) => {
    const { data } = await supabase.from('courses').select('*');
    res.json(data || []);
});
app.post('/api/courses', async (req, res) => {
    const { title, url, role, creator_id } = req.body;
    await supabase.from('courses').insert([{ title, content_url: url, required_role: role, created_by: creator_id }]);
    res.json({ status: 'ok' });
});

app.get('/', rootLimiter, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
server.listen(PORT, () => console.log(`✅ Evidentia MASTER Backend Active on port ${PORT}`));
