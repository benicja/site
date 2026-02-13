import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client for browser/public operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations (has elevated permissions)
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase;

// Database types
export interface ApprovedUser {
  id: string;
  email: string;
  role: string | null;
  approved_by: string | null;
  approved_at: string;
  created_at: string;
}

export interface AccessRequest {
  id: string;
  email: string;
  full_name: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'denied';
  request_token: string | null;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface UserSession {
  id: string;
  user_email: string;
  google_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  last_login: string;
  created_at: string;
}
