const CONFIG = {
    SUPABASE_URL: 'https://mvtatdvpsjynvayhhksc.supabase.co',
    SUPABASE_KEY: 'sb_publishable_XtV2kYHISXME2K-STuHmdw_UUGTZyvS',
    URL_SCRIPT: 'https://script.google.com/macros/s/AKfycbzzXvv1KtxUpBZVNfkhkZ6rI4iQEfk8SXHOgHeAa4jdH6-lLfKE-wswfMXtfaoeVMJC/exec',
};

// Cliente Global de Supabase

const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
