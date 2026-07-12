-- ============================================
-- Database Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_vehicle_id_timestamp
ON public.vehicle_locations
USING btree (vehicle_id, "timestamp" DESC)
TABLESPACE pg_default;


CREATE INDEX IF NOT EXISTS idx_timestamp
ON public.vehicle_locations
USING btree ("timestamp" DESC)
TABLESPACE pg_default;


CREATE INDEX IF NOT EXISTS idx_route_type
ON public.vehicle_locations
USING btree (route_type)
TABLESPACE pg_default;


CREATE INDEX IF NOT EXISTS idx_route_id
ON public.vehicle_locations
USING btree (route_id)
TABLESPACE pg_default;


CREATE INDEX IF NOT EXISTS idx_train_routes_code
ON public.vehicle_routes
USING btree (route_code)
TABLESPACE pg_default;