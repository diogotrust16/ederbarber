-- Enable RLS on admin_credentials table
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;

-- No policies = no public access. Only service_role (used by Edge Functions) can access.
-- This is the most secure approach for credential tables.

-- Also protect admin_sessions table
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- Add comments documenting the security model
COMMENT ON TABLE public.admin_credentials IS 
'Admin authentication credentials. No RLS policies = no public access. Only accessible via Edge Functions using service_role key.';

COMMENT ON TABLE public.admin_sessions IS 
'Admin session tokens. No RLS policies = no public access. Only accessible via Edge Functions using service_role key.';