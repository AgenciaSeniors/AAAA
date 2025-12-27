const CONFIG = {
    SUPABASE_URL: 'https://xwkmhpcombsauoozyidi.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3a21ocGNvbWJzYXVvb3p5aWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2OTQyODEsImV4cCI6MjA4MjI3MDI4MX0.DBRmGsJjxRggKqwF1o8Ec0LRzaMe7QcVR6rmWbvSbNI',
    URL_SCRIPT: 'https://script.google.com/macros/s/AKfycbzzXvv1KtxUpBZVNfkhkZ6rI4iQEfk8SXHOgHeAa4jdH6-lLfKE-wswfMXtfaoeVMJC/exec',
    RESTAURANT_ID: '3d615b07-c20b-492e-a3b1-e25951967a47',
};
// Agrega esto a js/config.js
const ORDEN_MENU = ['TRAGOS', 'BEBIDAS', 'CAFE', 'WHISKEY', 'RON', 'TAPAS', 'ESPECIALIDADES', 'AGREGOS'];

const NOMBRES_MOSTRAR = {
    'TRAGOS': 'Tragos 🍸',
    'BEBIDAS': 'Bebidas 🥤',
    'CAFE': 'Café ☕',
    'WHISKEY': 'Whiskies 🥃',
    'RON': 'Ron 🥃',
    'TAPAS': 'Tapas 🍟',
    'ESPECIALIDADES': 'Especiales ✨',
    'AGREGOS': 'Agregos 🍕'
};
// Cliente Global de Supabase

const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
