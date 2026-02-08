-- Add benefits column to services table (JSON array of benefit strings)
ALTER TABLE public.services 
ADD COLUMN benefits text[] DEFAULT NULL;

-- Add some sample benefits to existing subscription services
UPDATE public.services 
SET benefits = ARRAY['Corte ilimitado por mês', 'Agendamento prioritário', 'Desconto em produtos']
WHERE is_subscription = true AND name ILIKE '%corte%' AND name NOT ILIKE '%barba%';

UPDATE public.services 
SET benefits = ARRAY['Corte + barba ilimitados', 'Agendamento prioritário', 'Hidratação facial inclusa', 'Desconto em produtos']
WHERE is_subscription = true AND name ILIKE '%barba%';

UPDATE public.services 
SET benefits = ARRAY['Serviço ilimitado por mês', 'Atendimento preferencial']
WHERE is_subscription = true AND benefits IS NULL;