-- Create table for blocked time slots
CREATE TABLE public.blocked_times (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  professional_id UUID REFERENCES public.professionals(id) ON DELETE CASCADE NOT NULL,
  block_type TEXT NOT NULL CHECK (block_type IN ('recurring', 'specific')),
  -- For recurring blocks (day of week: 0=Sunday, 1=Monday, etc.)
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  -- For specific date blocks
  specific_date DATE,
  -- Time range
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  -- Optional reason
  reason TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Ensure end_time is after start_time
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  -- Ensure proper block type data
  CONSTRAINT valid_block_data CHECK (
    (block_type = 'recurring' AND day_of_week IS NOT NULL AND specific_date IS NULL) OR
    (block_type = 'specific' AND specific_date IS NOT NULL AND day_of_week IS NULL)
  )
);

-- Enable RLS
ALTER TABLE public.blocked_times ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_blocked_times_updated_at
  BEFORE UPDATE ON public.blocked_times
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_blocked_times_professional ON public.blocked_times(professional_id);
CREATE INDEX idx_blocked_times_recurring ON public.blocked_times(professional_id, day_of_week) WHERE block_type = 'recurring';
CREATE INDEX idx_blocked_times_specific ON public.blocked_times(professional_id, specific_date) WHERE block_type = 'specific';