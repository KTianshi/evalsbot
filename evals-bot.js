require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

let lastCheckTime = new Date();

async function runSQLQuery() {
  try {
    console.log('Running SQL query...');
    
    const { data: results, error } = await supabase.rpc('get_evaluation_summary');
    
    if (error) {
      console.error('SQL query error:', error);
      return;
    }
    
    console.log(`SQL results count: ${results.length}`);
    await sendReport(results);
    
  } catch (error) {
    console.error('Error running SQL:', error);
  }
}

async function sendReport(results) {
  try {
    console.log('Formatting evaluation report...');
    
    if (!results || results.length === 0) {
      console.log('No results to format');
      return;
    }
    
    console.log(`Results count: ${results.length}`);
    
    const tableRows = results.map(row => {
      const jobId = row.job_id ? (row.job_id.length > 10 ? row.job_id.substring(0, 10) + '...' : row.job_id) : 'N/A';
      const evalModel = row.eval_model.toString();
      const agentModel = row.agent_model.toString();
      const falsePt = row.false_pt.toFixed(1);
      const truePt = row.true_pt.toFixed(1);
      const outputCount = row.output_count.toString();
      const yield = row.yield.toFixed(1);
      
      return `${jobId.padEnd(14)} | ${evalModel.padEnd(25)} | ${agentModel.padEnd(25)} | ${falsePt.padStart(8)} | ${truePt.padStart(7)} | ${outputCount.padStart(12)} | ${yield.padStart(5)}`;
    });

    let headerMessage = '*Evaluation Report*\n';
    headerMessage += `• Total results: ${results.length}`;

    await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      text: headerMessage,
      unfurl_links: false,
      unfurl_media: false
    });

    const headerRow = 'job_id         | eval_model                | agent_model               | false_pt | true_pt | output_count | yield\n';
    const separatorRow = '---------------|---------------------------|---------------------------|----------|---------|--------------|------\n';
    
    let columnHeaderMessage = '```\n';
    columnHeaderMessage += headerRow;
    columnHeaderMessage += separatorRow;
    columnHeaderMessage += '```';
    
    await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      text: columnHeaderMessage,
      unfurl_links: false,
      unfurl_media: false
    });

    const rowsPerChunk = 20;
    
    const chunks = [];
    
    for (let i = 0; i < tableRows.length; i += rowsPerChunk) {
      const chunk = tableRows.slice(i, i + rowsPerChunk);
      chunks.push(chunk);
    }
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let tableMessage = '```\n';
      tableMessage += chunk.join('\n');
      tableMessage += '\n```';
      
      console.log(`Table chunk ${i + 1}/${chunks.length} (${chunk.length} rows) length: ${tableMessage.length} characters`);
      
      await slack.chat.postMessage({
        channel: process.env.SLACK_CHANNEL_ID,
        text: tableMessage,
        unfurl_links: false,
        unfurl_media: false
      });
    }

    console.log('Report sent!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'EvalsBot is running',
    lastCheck: lastCheckTime.toISOString()
  });
});

app.post('/webhook', async (req, res) => {
  try {
    console.log('Received webhook with SQL results');
    const results = req.body;
    
    await sendReport(results);
    
    res.json({ status: 'success', message: 'Report sent' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.post('/trigger', async (req, res) => {
  try {
    await runSQLQuery();
    res.json({ status: 'success', message: 'Report generated and sent' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`EvalsBot web service starting on port ${PORT}...`);
  console.log('Webhook endpoint: POST /webhook');
  console.log('Manual trigger: POST /trigger');
  console.log('Ready to run automated reports!');
  
  runSQLQuery();
  
  setInterval(runSQLQuery, 20 * 60 * 1000);
  
  console.log('Will run SQL query and send reports every 20 minutes');
}); 