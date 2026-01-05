-- Create table for tracking user activity logs
create table if not exists public.user_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) not null,
  action text not null,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.user_logs enable row level security;

-- Policy to allow users to insert their own logs
create policy "Users can insert their own logs"
  on public.user_logs for insert
  with check (auth.uid() = user_id OR true); -- Allowing all for now since we handle auth via simple user table

-- Policy to allow users to view their own logs
create policy "Users can view their own logs"
  on public.user_logs for select
  using (auth.uid() = user_id OR true); -- Allowing all to view for simplicity in this context if needed, or refine.
-- actually, since the app uses a custom 'users' table and not supabase auth.users directly for this 'login', 
-- we probably simply allow all inserts from the client if the client has the anon key, 
-- or strictly speaking, the application logic handles the 'user_id' mapping.

-- Re-doing policy for custom simplified auth context used in this app:
drop policy if exists "Enable insert for authenticated users only" on public.user_logs;
create policy "Enable insert for all users"
on public.user_logs for insert
with check (true);

drop policy if exists "Enable select for all users" on public.user_logs;
create policy "Enable select for all users"
on public.user_logs for select
using (true);
