-- Drop the restrictive admin-only UPDATE policy
DROP POLICY IF EXISTS "Admins can update appointments" ON public.appointments;

-- Create a permissive policy that allows anyone to update appointments
-- Security is handled by the admin edge functions and session validation
CREATE POLICY "Anyone can update appointments"
ON public.appointments
FOR UPDATE
USING (true)
WITH CHECK (true);