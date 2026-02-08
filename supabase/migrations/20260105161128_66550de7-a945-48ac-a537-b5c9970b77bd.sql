-- Remove the public SELECT policy on appointments
DROP POLICY IF EXISTS "Anyone can view appointments" ON public.appointments;

-- Create a restrictive SELECT policy (only service role can access directly)
-- This effectively blocks direct client access, forcing use of edge functions
CREATE POLICY "Service role only can select appointments"
ON public.appointments
FOR SELECT
TO service_role
USING (true);