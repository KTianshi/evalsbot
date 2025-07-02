require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const { createClient } = require('@supabase/supabase-js');

// Initialize clients
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testLastRow() {
  try {
    console.log('🧪 Testing: Get last row and send to Slack...\n');
    
    // Get the most recent row
    const { data, error } = await supabase
      .from('eval_results')
      .select('eval_result_id, created_at, eval_output')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('❌ Error querying database:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('❌ No data found in table');
      return;
    }
    
    const lastRow = data[0];
    console.log('📊 Last row found:');
    console.log('   eval_result_id:', lastRow.eval_result_id);
    console.log('   created_at:', lastRow.created_at);
    
    // Parse the eval_output
    let evalOutput;
    try {
      evalOutput = typeof lastRow.eval_output === 'string' 
        ? JSON.parse(lastRow.eval_output) 
        : lastRow.eval_output;
      console.log('   is_valid:', evalOutput.is_valid);
    } catch (e) {
      console.log('   Error parsing eval_output:', e.message);
      evalOutput = { is_valid: 'Error parsing output' };
    }
    
    // Send to Slack
    console.log('\n📤 Sending to Slack...');
    const isValid = evalOutput.is_valid;
    const message = `*New Evaluation Result*\n• ID: ${lastRow.eval_result_id}\n• Valid: ${isValid}\n• Created: ${new Date(lastRow.created_at).toLocaleString()}`;

    const result = await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      text: message,
      unfurl_links: false,
      unfurl_media: false
    });
    
    console.log('✅ Message sent successfully!');
    console.log('   Timestamp:', result.ts);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testLastRow(); 