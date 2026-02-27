-- 1. Helper function (Must be created FIRST)
create or replace function public.is_service_role()
returns boolean as $$
begin
  return (auth.jwt() ->> 'role') = 'service_role';
end;
$$ language plpgsql security definer;

-- 2. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 3. Create VEHICLES table
create table if not exists public.vehicles (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  plate_number text not null unique,
  rfid_tag text unique,
  owner_id uuid references auth.users(id),
  color text,
  body_type text,
  model text,
  status text default 'PENDING' check (status in ('ACTIVE', 'PENDING', 'BLACKLISTED'))
);

-- 4. Create ACCESS LOGS table
create table if not exists public.access_logs (
  id uuid default gen_random_uuid() primary key,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  vehicle_id uuid references public.vehicles(id),
  plate_detected text,
  action text check (action in ('ENTRY', 'EXIT')),
  status text check (status in ('GRANTED', 'DENIED', 'MANUAL_CHECK')),
  gate text,
  image_url text
);

-- 5. Enable Row Level Security
alter table public.vehicles enable row level security;
alter table public.access_logs enable row level security;

-- 6. Policies (Drop existing to avoid errors on retry)
drop policy if exists "Service Role Full Access Vehicles" on public.vehicles;
drop policy if exists "Users View Own Vehicles" on public.vehicles;
drop policy if exists "Users Insert Own Vehicles" on public.vehicles;
drop policy if exists "Service Role Full Access Logs" on public.access_logs;
drop policy if exists "Users View Own Logs" on public.access_logs;

-- Policies definition
create policy "Service Role Full Access Vehicles" on public.vehicles
  for all using ( is_service_role() );

create policy "Users View Own Vehicles" on public.vehicles
  for select using ( auth.uid() = owner_id );

create policy "Users Insert Own Vehicles" on public.vehicles
  for insert with check ( auth.uid() = owner_id );

create policy "Service Role Full Access Logs" on public.access_logs
  for all using ( is_service_role() );

create policy "Users View Own Logs" on public.access_logs
  for select using ( 
    exists (
      select 1 from public.vehicles 
      where vehicles.id = access_logs.vehicle_id 
      and vehicles.owner_id = auth.uid()
    )
  );

-- 7. Create PROFILES table (For User Roles)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text, -- Added email column
  full_name text,
  phone text,
  role text default 'STUDENT' check (role in ('ADMIN', 'STUDENT', 'FACULTY', 'STAFF')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. RLS for Profiles
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone" on public.profiles
  for select using (true);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- 9. Trigger to create Profile on Sign Up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email, -- Insert email from auth.users
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    coalesce(new.raw_user_meta_data->>'role', 'STUDENT')
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger logic (Drop first to avoid duplication errors)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
