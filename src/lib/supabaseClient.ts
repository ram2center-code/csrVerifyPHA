import { createClient } from '@supabase/supabase-js';

// อ่านค่าจาก import.meta.env หรือ fallback
const getEnvVar = (key: string): string => {
  try {
    const val = (import.meta.env as any)?.[key];
    if (val && typeof val === 'string' && val.trim() !== '') {
      return val.trim();
    }
  } catch (e) {
    console.warn(`Could not read env ${key}:`, e);
  }
  return '';
};

export const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
export const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'https://your-project-id.supabase.co' &&
  supabaseUrl !== 'https://placeholder.supabase.co'
);

// Debug Log ใน Console เพื่อให้เช็คได้ทันทีบน Netlify / Production
if (typeof window !== 'undefined') {
  console.log('[Supabase Init Status]:', {
    hasUrl: Boolean(supabaseUrl),
    urlPreview: supabaseUrl ? `${supabaseUrl.substring(0, 14)}...` : 'MISSING',
    hasKey: Boolean(supabaseAnonKey),
    keyLength: supabaseAnonKey ? supabaseAnonKey.length : 0,
    isConfigured: isSupabaseConfigured,
  });
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);
