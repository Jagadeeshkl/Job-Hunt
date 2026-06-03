import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client using service key (for API routes only)
export function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL ?? supabaseUrl,
    process.env.SUPABASE_SERVICE_KEY!
  );
}
