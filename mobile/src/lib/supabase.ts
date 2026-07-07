import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  if (__DEV__) {
    console.error(
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set. ' +
      'Create a mobile/.env file from mobile/.env.example and fill in your credentials.'
    );
  } else {
    throw new Error(
      'Missing Supabase credentials. Configure EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY in EAS Build secrets or .env.'
    )
  }
}

export const supabase = createClient(
  supabaseUrl!,
  supabaseAnonKey!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
