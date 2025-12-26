const CONFIG = {
    SUPABASE_URL: 'https://xwkmhpcombsauoozyidi.supabase.co',
    SUPABASE_KEY: 'sb_publishable_5iDJi-xK69y1DM0nFYjqlw_TaozemSt',
    URL_SCRIPT: 'https://script.google.com/macros/s/AKfycbzzXvv1KtxUpBZVNfkhkZ6rI4iQEfk8SXHOgHeAa4jdH6-lLfKE-wswfMXtfaoeVMJC/exec',
    RESTAURANT_ID: '3d615b07-c20b-492e-a3b1-e25951967a47',
};

// Cliente Global de Supabase

const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
