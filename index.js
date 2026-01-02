// 1. Import required libraries
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); // Load environment variables locally

// 2. Initialize the Express app
const app = express();

// 3. Set up Middleware (allows your app to accept JSON and work from other domains)
app.use(cors());
app.use(express.json());

// 4. Initialize Supabase Client
// We use the environment variables defined in your Vercel dashboard
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Make sure to add this in your dashboard if you haven't!
const supabase = createClient(supabaseUrl, supabaseKey);

// 5. Create a basic Test Route
// This helps you confirm the server is running when you visit the URL
app.get('/', (req, res) => {
  res.json({ message: "API is working correctly!" });
});

// 6. Example API Route: Get data from Supabase
// You can remove or change 'your_table_name' to a real table in your database
app.get('/api/data', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('your_table_name') 
      .select('*');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Vercel & Local Deployment Setup
// This is the critical part that fixes your "Unsupported framework" issues
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  // Runs when you type 'node index.js' locally
  app.listen(PORT, () => {
    console.log(`Server running locally on port ${PORT}`);
  });
}

// Exports the app for Vercel's serverless environment
module.exports = app;