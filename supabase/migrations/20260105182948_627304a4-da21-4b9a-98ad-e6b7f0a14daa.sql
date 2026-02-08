-- Create admin_sessions table for server-side session validation
CREATE TABLE public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.admin_credentials(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS to block client access (service role only)
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX idx_admin_sessions_token ON public.admin_sessions(token);
CREATE INDEX idx_admin_sessions_expires ON public.admin_sessions(expires_at);
CREATE INDEX idx_admin_sessions_admin_id ON public.admin_sessions(admin_id);

-- Add needs_rehash column for gradual password migration
ALTER TABLE public.admin_credentials ADD COLUMN IF NOT EXISTS needs_rehash BOOLEAN DEFAULT TRUE;

-- Add comments for documentation
COMMENT ON TABLE public.admin_sessions IS 'Admin session storage. Service role only access via Edge Functions.';
COMMENT ON TABLE public.admin_credentials IS 'Admin authentication credentials. Service role only access. Uses bcrypt password hashing.';