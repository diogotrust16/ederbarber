-- Remove the overly permissive policy
DROP POLICY IF EXISTS "Service role can manage professionals" ON public.professionals;