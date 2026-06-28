-- Supabase SQL Schema for RideFlow
-- Paste this entire block into the Supabase SQL Editor and run it!

-- 1. Create custom_users table (Bypassing Supabase Auth as requested)
CREATE TABLE IF NOT EXISTS public.custom_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT,
  last_name TEXT,
  phone TEXT,
  emergency_phone TEXT,
  bike_model TEXT,
  photo_url TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create rides table for history
CREATE TABLE IF NOT EXISTS public.rides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.custom_users(id) ON DELETE CASCADE,
  destination_name TEXT NOT NULL,
  dest_lat FLOAT,
  dest_lng FLOAT,
  member_limit INTEGER DEFAULT 4,
  privacy TEXT DEFAULT 'public',
  status TEXT DEFAULT 'active', -- 'active', 'ended', or 'cancelled'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS (Row Level Security) but allow all operations for this hackathon
-- The user requested to enable RLS so there's no fetching issue.
ALTER TABLE public.custom_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- Allow completely public access to custom_users (since we handle login manually in app)
CREATE POLICY "Allow public read custom_users" ON public.custom_users FOR SELECT USING (true);
CREATE POLICY "Allow public insert custom_users" ON public.custom_users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update custom_users" ON public.custom_users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete custom_users" ON public.custom_users FOR DELETE USING (true);

-- Allow completely public access to rides
CREATE POLICY "Allow public read rides" ON public.rides FOR SELECT USING (true);
CREATE POLICY "Allow public insert rides" ON public.rides FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update rides" ON public.rides FOR UPDATE USING (true);
CREATE POLICY "Allow public delete rides" ON public.rides FOR DELETE USING (true);

-- 4. Insert default mock user (if they don't exist)
INSERT INTO public.custom_users (email, password, name, last_name, phone, emergency_phone, bike_model, is_admin)
VALUES (
  'omkar.jagtap@gmail.com', 
  'Satara@2026', 
  'Omkar', 
  'Jagtap', 
  '+91 0000000000', 
  '+91 1111111111', 
  'Kawasaki Ninja', 
  true
) ON CONFLICT (email) DO NOTHING;
