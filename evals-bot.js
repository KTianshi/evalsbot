require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const { createClient } = require('@supabase/supabase-js');

// Initialize clients
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Track the last check time
let lastCheckTime = new Date();

async function checkNewEvaluations() {
  try {
    console.log('🔍 Checking for new evaluation results...');
    
    // Query for new results since last check
    const { data: newResults, error } = await supabase
      .from('eval_results')
      .select('eval_result_id, created_at, eval_output')
      .gt('created_at', lastCheckTime.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error querying Supabase:', error);
      return;
    }

    if (newResults && newResults.length > 0) {
      console.log(`📊 Found ${newResults.length} new evaluation result(s)`);
      
      // Send notification for each new result
      for (const result of newResults) {
        await sendEvaluationNotification(result);
      }
    } else {
      console.log('✅ No new evaluation results found');
    }

    // Update last check time
    lastCheckTime = new Date();
    
  } catch (error) {
    console.error('❌ Error checking evaluations:', error);
  }
}

async function sendEvaluationNotification(result) {
  try {
    // Format the message based on your table structure
    let evalOutput;
    try {
      evalOutput = typeof result.eval_output === 'string' 
        ? JSON.parse(result.eval_output) 
        : result.eval_output;
    } catch (e) {
      evalOutput = { is_valid: 'Error parsing output' };
    }
    
    const isValid = evalOutput.is_valid;
    
    const message = `*New Evaluation Result*\n• ID: ${result.eval_result_id}\n• Valid: ${isValid}\n• Created: ${new Date(result.created_at).toLocaleString()}`;

    const slackResult = await slack.chat.postMessage({
      channel: process.env.SLACK_CHANNEL_ID,
      text: message,
      unfurl_links: false,
      unfurl_media: false
    });

    console.log(`✅ Notification sent for evaluation ID: ${result.id}`);
    
  } catch (error) {
    console.error('❌ Error sending Slack notification:', error);
  }
}

// Main function to run the check
async function main() {
  console.log('🤖 EvalsBot starting...');
  console.log('⏰ Will check for new evaluations every 10 minutes');
  
  // Run initial check
  await checkNewEvaluations();
  
  // Set up interval to check every 10 minutes
  setInterval(checkNewEvaluations, 10 * 60 * 1000);
}

// Run the bot
main(); 