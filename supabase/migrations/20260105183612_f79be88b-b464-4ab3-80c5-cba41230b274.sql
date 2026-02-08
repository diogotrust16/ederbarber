-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Service role only can select appointments" ON public.appointments;

-- Create a permissive policy that allows anyone to view appointments (for admin panel)
-- The admin panel uses anon key but validates admin session via edge functions
CREATE POLICY "Anyone can view appointments"
ON public.appointments
FOR SELECT
USING (true);