-- Add client info columns to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS client_name text,
ADD COLUMN IF NOT EXISTS client_phone text;

-- Make user_id nullable for public bookings
ALTER TABLE public.appointments 
ALTER COLUMN user_id DROP NOT NULL;

-- Drop existing restrictive RLS policies
DROP POLICY IF EXISTS "Users can cancel their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can create their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can update their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;

-- Create new policy allowing public inserts with client info
CREATE POLICY "Anyone can create appointments with client info" 
ON public.appointments 
FOR INSERT 
WITH CHECK (
  client_name IS NOT NULL AND 
  client_phone IS NOT NULL
);

-- Allow public to view their appointments by phone (for future lookup feature)
CREATE POLICY "Anyone can view appointments" 
ON public.appointments 
FOR SELECT 
USING (true);