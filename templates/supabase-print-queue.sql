-- Ejecutar una sola vez en el SQL Editor del proyecto Supabase de CADA ERP.
-- El ERP escribe como propietario de la base de datos; el cliente Windows usa
-- un usuario Supabase Auth exclusivo que solo puede leer sus propios trabajos.

create table if not exists public.print_devices (
  user_id uuid primary key,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  device_user_id uuid not null references public.print_devices(user_id),
  request_id text not null unique,
  sale_id text not null,
  payload_base64 text not null check (octet_length(payload_base64) <= 350000),
  status text not null default 'pending' check (status in ('pending','printing','printed','uncertain')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  printed_at timestamptz,
  last_error text,
  attempt_count integer not null default 0
);

create index if not exists print_jobs_pending_idx
  on public.print_jobs (device_user_id, created_at)
  where status = 'pending';

create index if not exists print_jobs_uncertain_idx
  on public.print_jobs (device_user_id, created_at)
  where status = 'uncertain';

alter table public.print_devices enable row level security;
alter table public.print_jobs enable row level security;

drop policy if exists print_jobs_device_read on public.print_jobs;
create policy print_jobs_device_read on public.print_jobs
  for select to authenticated using (device_user_id = (select auth.uid()));

revoke all on public.print_devices from anon, authenticated;
revoke all on public.print_jobs from anon, authenticated;
grant select on public.print_jobs to authenticated;

create or replace function public.claim_print_job()
returns table (id uuid, payload_base64 text)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null or not exists (select 1 from public.print_devices where user_id = v_user and active) then
    raise exception 'Dispositivo no autorizado';
  end if;

  -- No reimprimir automáticamente un trabajo cuyo resultado es desconocido.
  update public.print_jobs
     set status = 'uncertain', last_error = 'La PC se reinició durante la impresión'
   where device_user_id = v_user and status = 'printing'
     and claimed_at < now() - interval '2 minutes';

  return query
    with next_job as (
      select j.id from public.print_jobs j
       where j.device_user_id = v_user and j.status = 'pending'
       order by j.created_at, j.id
       for update skip locked limit 1
    )
    update public.print_jobs j
       set status = 'printing', claimed_at = now(), attempt_count = attempt_count + 1
      from next_job
     where j.id = next_job.id
    returning j.id, j.payload_base64;
end $$;

create or replace function public.ack_print_job(p_job_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.print_jobs set status = 'printed', printed_at = now(), last_error = null
   where id = p_job_id and device_user_id = auth.uid() and status = 'printing';
  return found;
end $$;

create or replace function public.fail_print_job(p_job_id uuid, p_error text)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update public.print_jobs set status = 'uncertain', last_error = left(p_error, 500)
   where id = p_job_id and device_user_id = auth.uid() and status = 'printing';
  return found;
end $$;

create or replace function public.resolve_print_job(p_job_id uuid, p_action text)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_action = 'printed' then
    update public.print_jobs set status = 'printed', printed_at = now(), last_error = null
     where id = p_job_id and device_user_id = auth.uid() and status = 'uncertain';
  elsif p_action = 'requeue' then
    update public.print_jobs set status = 'pending', claimed_at = null, last_error = null
     where id = p_job_id and device_user_id = auth.uid() and status = 'uncertain';
  else
    raise exception 'Acción inválida';
  end if;
  return found;
end $$;

revoke all on function public.claim_print_job() from public, anon;
revoke all on function public.ack_print_job(uuid) from public, anon;
revoke all on function public.fail_print_job(uuid, text) from public, anon;
revoke all on function public.resolve_print_job(uuid, text) from public, anon;
grant execute on function public.claim_print_job() to authenticated;
grant execute on function public.ack_print_job(uuid) to authenticated;
grant execute on function public.fail_print_job(uuid, text) to authenticated;
grant execute on function public.resolve_print_job(uuid, text) to authenticated;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'print_jobs'
  ) then
    alter publication supabase_realtime add table public.print_jobs;
  end if;
end $$;
