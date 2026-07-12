-- ============================================
-- Database Schema
-- ============================================

-- Vehicle GPS locations
CREATE TABLE public.vehicle_locations (
  id BIGSERIAL NOT NULL,
  vehicle_id CHARACTER VARYING(50) NOT NULL,
  route_id CHARACTER VARYING(50) NULL,
  run_id CHARACTER VARYING(50) NULL,
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  direction_id INTEGER NULL,
  heading NUMERIC(5, 2) NULL,
  route_type INTEGER NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),

  CONSTRAINT vehicle_locations_pkey PRIMARY KEY (id),

  CONSTRAINT vehicle_locations_vehicle_id_timestamp_key
    UNIQUE (vehicle_id, "timestamp")
)
TABLESPACE pg_default;


-- Vehicle routes
CREATE TABLE public.vehicle_routes (
  route_id TEXT NOT NULL,
  route_name TEXT NOT NULL,
  route_code TEXT NOT NULL,
  route_color TEXT NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL
    DEFAULT timezone('utc'::text, now()),

  updated_at TIMESTAMP WITH TIME ZONE NOT NULL
    DEFAULT timezone('utc'::text, now()),

  CONSTRAINT train_routes_pkey PRIMARY KEY (route_id),

  CONSTRAINT train_routes_route_code_key UNIQUE (route_code)
)
TABLESPACE pg_default;