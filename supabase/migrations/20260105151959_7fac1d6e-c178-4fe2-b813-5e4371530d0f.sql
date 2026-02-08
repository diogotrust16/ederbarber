-- Create professionals table
CREATE TABLE public.professionals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view active professionals
CREATE POLICY "Anyone can view active professionals"
ON public.professionals
FOR SELECT
USING (is_active = true);

-- Add professional_id to appointments
ALTER TABLE public.appointments 
ADD COLUMN professional_id UUID REFERENCES public.professionals(id);

-- Insert sample professionals
INSERT INTO public.professionals (name, avatar_url) VALUES
('Edercio Rodrigues', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'),
('Júnior Silva', 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face');