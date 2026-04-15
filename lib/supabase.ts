/**
 * Supabase client — session must persist on device (React Native has no localStorage).
 * Without `auth.storage`, refresh tokens are lost on restart and reconcileAuthSession signs users out.
 */

import { createClient } from '@supabase/supabase-js'
import { storage } from './storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
