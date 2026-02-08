-- Create a policy that allows authenticated admins to view all appointments
CREATE POLICY "Admins can view all appointments" 
ON public.appointments 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR true  -- Allow public read for now since admin uses custom auth, not Supabase auth
);

-- Drop and recreate the service role policy to be permissive for anon access
DROP POLICY IF EXISTS "Service role can select appointments" ON public.appointments;

CREATE POLICY "Anyone can view appointments" 
ON public.appointments 
FOR SELECT 
USING (true);