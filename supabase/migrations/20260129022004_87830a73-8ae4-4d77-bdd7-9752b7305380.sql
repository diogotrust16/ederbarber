-- Create business_hours table for store operating hours
CREATE TABLE public.business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_open boolean NOT NULL DEFAULT true,
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '18:00',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_day_of_week UNIQUE (day_of_week),
  CONSTRAINT valid_hours CHECK (close_time > open_time)
);

-- Enable RLS
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;

-- Deny public access - only accessible via service role (edge functions)
CREATE POLICY "Deny public access to business_hours"
  ON public.business_hours
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Insert default schedule
INSERT INTO public.business_hours (day_of_week, is_open, open_time, close_time) VALUES
  (0, false, '09:00', '18:00'),
  (1, true, '09:00', '19:00'),
  (2, true, '09:00', '19:00'),
  (3, true, '09:00', '19:00'),
  (4, true, '09:00', '19:00'),
  (5, true, '09:00', '19:00'),
  (6, true, '09:00', '17:00');