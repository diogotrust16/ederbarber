-- Allow anonymous/public read access to business_hours so the client can render horários corretamente
alter table public.business_hours enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'business_hours'
      and policyname = 'Allow public read business_hours'
  ) then
    create policy "Allow public read business_hours"
      on public.business_hours
      for select
      to public
      using (true);
  end if;
end$$;
