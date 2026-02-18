-- Create the rate_limits table
create table if not exists rate_limits (
  key text primary key,
  count int default 1,
  last_request timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Row Level Security (RLS) is good practice, but for backend-only access 
-- via service_role key, it's not strictly necessary if no public access is allowed.
-- However, enabling it and adding no policies effectively makes it private by default for anon users.
alter table rate_limits enable row level security;
