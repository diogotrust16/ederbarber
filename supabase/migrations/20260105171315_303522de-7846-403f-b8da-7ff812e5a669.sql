-- Allow admins to view all services (including inactive)
CREATE POLICY "Admins can view all services"
ON public.services
FOR SELECT
USING (public.has_role(auth.uid(), 'admin') OR is_active = true);

-- Drop the old policy and recreate with better logic
DROP POLICY IF EXISTS "Anyone can view active services" ON public.services;

CREATE POLICY "Public can view active services"
ON public.services
FOR SELECT
USING (is_active = true);

-- Allow admins to insert services
CREATE POLICY "Admins can insert services"
ON public.services
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update services
CREATE POLICY "Admins can update services"
ON public.services
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete services
CREATE POLICY "Admins can delete services"
ON public.services
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));