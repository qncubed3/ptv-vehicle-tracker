-- ============================================
-- Seed Melbourne metro train routes
-- Safe to re-run (upserts on route_id)
-- ============================================

INSERT INTO vehicle_routes (
    route_id,
    route_name,
    route_code,
    route_color
)
VALUES
    ('1', 'Alamein', 'ALM', 'rgba(1, 81, 138, 1)'),
    ('11', 'Pakenham', 'PKM', 'rgba(0, 168, 228, 1)'),
    ('12', 'Sandringham', 'SHM', 'rgba(241, 127, 177, 1)'),
    ('14', 'Sunbury', 'SUN', 'rgba(0, 168, 228, 1)'),
    ('15', 'Upfield', 'UFD', 'rgba(252, 184, 24, 1)'),
    ('16', 'Werribee', 'WER', 'rgba(241, 127, 177, 1)'),
    ('17', 'Williamstown', 'WIL', 'rgba(241, 127, 177, 1)'),
    ('2', 'Belgrave', 'BEG', 'rgba(1, 81, 138, 1)'),
    ('3', 'Craigieburn', 'CGE', 'rgba(252, 184, 24, 1)'),
    ('4', 'Cranbourne', 'CBE', 'rgba(0, 168, 228, 1)'),
    ('5', 'Mernda', 'MND', 'rgba(208, 32, 46, 1)'),
    ('6', 'Frankston', 'FKN', 'rgba(0, 150, 69, 1)'),
    ('7', 'Glen Waverley', 'GWY', 'rgba(1, 81, 138, 1)'),
    ('8', 'Hurstbridge', 'HBE', 'rgba(208, 32, 46, 1)'),
    ('9', 'Lilydale', 'LIL', 'rgba(1, 81, 138, 1)')
ON CONFLICT (route_id) DO UPDATE
SET
    route_name = EXCLUDED.route_name,
    route_code = EXCLUDED.route_code,
    route_color = EXCLUDED.route_color,
    updated_at = timezone('utc'::text, now());
