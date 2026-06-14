import { createClient } from '@supabase/supabase-js';

// Server-side client using the service key (API routes only). Created lazily
// inside the function so importing this module never instantiates a client at
// build/collect time (which would crash before env vars are available).
export function getServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase env vars missing — set SUPABASE_URL and SUPABASE_SERVICE_KEY in the deployment environment.'
    );
  }
  return createClient(url, key);
}
