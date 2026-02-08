-- RLS policies for blocked_times - only accessible via service role (edge functions)
CREATE POLICY "Deny public access to blocked_times" 
ON public.blocked_times 
FOR ALL 
USING (false)
WITH CHECK (false);