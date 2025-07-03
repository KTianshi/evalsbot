require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');

// Initialize clients
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Track the last check time
let lastCheckTime = new Date();

async function sendReport(results) {
  try {
    console.log('📊 Formatting evaluation report...');
    
    if (!results || results.length === 0) {
      console.log('❌ No results to format');
      return;
    }
    
    console.log(`📈 Results count: ${results.length}`);
    
    // Format as a monospaced table
    let message = '*Evaluation Report*\n';
    message += `• Generated: ${new Date().toLocaleString()}\n`;
    message += `• Total results: ${results.length}\n\n`;
    message += '```\n';
    message += 'sheet_title   eval_model   agent_model   false_pt   true_pt   output_count   yield\n';
    message += '-----------  ----------  -----------  --------   -------   -----------   -----\n';
    results.forEach(row => {
      const sheetTitle = row.sheet_title ? row.sheet_title.substring(0, 8) + '...' : 'N/A';
      message += `${sheetTitle.padEnd(13)}${row.eval_model.toString().padEnd(13)}${row.agent_model.toString().padEnd(13)}${row.false_pt.toFixed(1).padEnd(10)}${row.true_pt.toFixed(1).padEnd(9)}${row.output_count.toString().padEnd(14)}${row.yield.toFixed(1).padEnd(7)}\n`;
    });
    message += '```';

    await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      text: message,
      unfurl_links: false,
      unfurl_media: false
    });

    console.log('✅ Report sent!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Set up Express server for web service
const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'EvalsBot is running',
    lastCheck: lastCheckTime.toISOString()
  });
});

// Webhook endpoint to receive SQL results
app.post('/webhook', async (req, res) => {
  try {
    console.log('📥 Received webhook with SQL results');
    const results = req.body;
    
    await sendReport(results);
    
    res.json({ status: 'success', message: 'Report sent' });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Manual trigger endpoint
app.post('/trigger', async (req, res) => {
  try {
    // For manual trigger, you could run the SQL query here
    res.json({ status: 'success', message: 'Use /webhook endpoint to send data' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🤖 EvalsBot web service starting on port ${PORT}...`);
  console.log('📡 Webhook endpoint: POST /webhook');
  console.log('✅ Ready to receive SQL results!');
  
  // Run initial report
  sendReport();
  
  // Set up interval for periodic reports (every 20 minutes)
  setInterval(sendReport, 20 * 60 * 1000);
  
  console.log('⏰ Will send reports every 20 minutes');
}); 