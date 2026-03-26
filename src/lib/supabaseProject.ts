// Single source of truth for the active Supabase project used by this frontend.

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://krkybhborwvcbjzjcghw.supabase.co";
export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtya3liaGJvcnd2Y2JqempjZ2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0OTYwNDksImV4cCI6MjA4NzA3MjA0OX0.mwm0aTd9ZBltJD5VgOFN7vZ6jibpKsF8dGdcSwOg1cw";
