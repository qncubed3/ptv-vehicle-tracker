// lib/supabase/server.ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/database/types'

export function createClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}