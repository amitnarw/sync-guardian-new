import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 192.168.29.103 is your laptop's local IP on your Wi-Fi network, allowing physical devices to connect.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://192.168.29.103:54321';

// Default anon key for local Supabase setups
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZmF1bHQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0MjQ4Njc3OCwiZXhwIjoxOTU4MDU0Nzc4fQ.a63mZlBq0x03p52fL23m3-iKqO997y58rS_O0l-Mv3k';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
