-- Add RLS policies for admin management of professionals
CREATE POLICY "Service role can manage professionals"
ON public.professionals
FOR ALL
USING (true)
WITH CHECK (true);

-- Allow admins to insert professionals
CREATE POLICY "Admins can insert professionals"
ON public.professionals
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update professionals  
CREATE POLICY "Admins can update professionals"
ON public.professionals
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete professionals
CREATE POLICY "Admins can delete professionals"
ON public.professionals
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to view all professionals (including inactive)
CREATE POLICY "Admins can view all professionals"
ON public.professionals
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR is_active = true);