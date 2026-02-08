-- SECURITY: lock down PII and keep admin operations via backend functions

-- Ensure RLS is enabled
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- Remove overly-permissive appointment read policies (PII)
DROP POLICY IF EXISTS "Anyone can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admins can view all appointments" ON public.appointments;

-- Recreate service-role-only policies for appointments
DROP POLICY IF EXISTS "Service role can select appointments" ON public.appointments;
DROP POLICY IF EXISTS "Service role can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Service role can update appointments" ON public.appointments;

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

-- Add explicit deny-all policies to silence linter while keeping tables inaccessible from the client
DROP POLICY IF EXISTS "Deny all access" ON public.admin_credentials;
CREATE POLICY "Deny all access"
ON public.admin_credentials
FOR ALL
TO public
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all access" ON public.admin_sessions;
CREATE POLICY "Deny all access"
ON public.admin_sessions
FOR ALL
TO public
USING (false)
WITH CHECK (false);
