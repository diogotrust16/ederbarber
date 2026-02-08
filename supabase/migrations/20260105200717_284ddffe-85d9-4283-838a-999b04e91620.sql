-- Fix RLS policies for appointments table
-- Restrict access to service_role only (Edge Functions with service role key)
-- This ensures all appointment access goes through authenticated Edge Functions

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Anyone can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Anyone can create appointments with client info" ON public.appointments;

-- Create restrictive policies for service_role only
-- These policies allow Edge Functions (using service role key) to manage appointments
CREATE POLICY "Service role can select appointments"
ON public.appointments
FOR SELECT
TO service_role
USING (true);

CREATE POLICY "Service role can insert appointments"
ON public.appointments
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update appointments"
ON public.appointments
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Keep existing admin delete policy for authenticated admins via Supabase Auth
-- This allows admins who authenticate via Supabase Auth to delete appointments

-- Also add policies for the public/anon key via authenticated Edge Functions
-- The get-availability function needs to read appointment times (no PII)
-- But this is handled by service_role in the Edge Function

-- Add comment documenting the security model
COMMENT ON TABLE public.appointments IS 
'Customer appointments. Direct client access restricted to service_role only. '
'All customer and admin operations must go through Edge Functions that '
'validate authentication tokens before performing database operations. '
'This ensures defense-in-depth security with database-level access control.';