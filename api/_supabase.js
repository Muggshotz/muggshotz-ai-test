import { createClient } from "@supabase/supabase-js";

// Shared Supabase connection, used by any API file that needs to read or
// write customer/token data. Uses the service role key (not the public
// anon key) because these are server-side functions that need full
// read/write access — this key must NEVER be exposed to the browser.
//
// Expects DATABASE_URL (already set on Vercel) to be a standard Postgres
// connection string is NOT what Supabase's JS client uses directly —
// the JS client needs the project URL + service role key instead, so
// those two values must also be set as their own environment variables:
//   SUPABASE_URL              e.g. https://nhyjxkmvmnuktahfvbwj.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  found in Supabase dashboard > Project Settings > API

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
