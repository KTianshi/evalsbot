require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function testSupabase() {
  try {
    console.log('🔍 Testing Supabase connection...\n');
    
    // Test basic connection
    console.log('1. Testing connection...');
    const { data, error } = await supabase
      .from('eval_results')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error connecting to Supabase:', error);
      return;
    }
    
    console.log('✅ Successfully connected to Supabase!');
    console.log(`   Found ${data.length} row(s) in eval_results table\n`);
    
    // Show table structure
    if (data.length > 0) {
      console.log('2. Table structure (sample row):');
      const sampleRow = data[0];
      Object.keys(sampleRow).forEach(key => {
        console.log(`   - ${key}: ${sampleRow[key]} (${typeof sampleRow[key]})`);
      });
    } else {
      console.log('2. Table is empty - no sample data available');
    }
    
    // Test recent data query
    console.log('\n3. Testing recent data query...');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { data: recentData, error: recentError } = await supabase
      .from('eval_results')
      .select('*')
      .gt('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false });
    
    if (recentError) {
      console.error('❌ Error querying recent data:', recentError);
    } else {
      console.log(`✅ Found ${recentData.length} recent evaluation(s) (last hour)`);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testSupabase(); 