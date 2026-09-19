import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const SUPABASE_URL = "https://ximmktvbqsijgpawhcee.supabase.co";

export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpbW1rdHZicXNpamdwYXdoY2VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NzkxMzcsImV4cCI6MjEwMzE1NTEzN30." +
  "-NR4rVrqrK7TvtMow0n5jbZNZcvR-7Re9MOt_-6yXU8";

// Directly connected to project: ximmktvbqsijgpawhcee
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
