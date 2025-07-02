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
      .select('*')
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
    // Adjust these fields based on your actual eval_results table columns
    const message = `🎯 **New Evaluation Result**
• **Task**: ${result.task_name || 'Unknown'}
• **Score**: ${result.score || 'N/A'}
• **Status**: ${result.status || 'Unknown'}
• **Created**: ${new Date(result.created_at).toLocaleString()}`;

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