
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yochbbecyadbiixercyq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvY2hiYmVjeWFkYmlpeGVyY3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NzE2NzEsImV4cCI6MjA4MzE0NzY3MX0.t8NN5V9UhbmMcjzJEkXnhzB65GcC0itp6QG7y2zij9g';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
