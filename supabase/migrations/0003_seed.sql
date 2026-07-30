-- ============================================================================
-- CYBER-TRACKER 365 :: MIGRATION 0003 :: CYBERWARE CATALOG SEED
-- ============================================================================

insert into public.gear_catalog (code, name, slot, cost, exp_multiplier, rarity, glyph, description) values
  ('titanium_belt',   'Titanium Lifting Belt',   'waist',  1200, 1.15, 'rare',      'BELT', 'Servo-tensioned lumbar brace. +15% EXP on squat & deadlift protocols.'),
  ('magnetic_wraps',  'Magnetic Wrist Traps',    'wrist',   850, 1.10, 'uncommon',  'WRST', 'Electro-magnetic stabilisers. +10% EXP on all pressing protocols.'),
  ('carbon_grips',    'Carbon Nano-Grips',       'hands',   600, 1.08, 'common',    'GRIP', 'Graphene palm lattice. +8% EXP, immunity to grip failure logs.'),
  ('spinal_rig',      'Spinal Exo-Rig MK-II',    'spine',  2400, 1.25, 'epic',      'SPNE', 'Full posterior chain exoskeleton. +25% EXP on all gym sessions.'),
  ('neural_link',     'Neural Focus Link',       'neural', 3600, 1.35, 'legendary', 'NRL',  'Direct cortex overclock. +35% EXP. Boss damage x2.'),
  ('grav_boots',      'Gravity Inversion Boots', 'boots',  1500, 1.18, 'rare',      'BOOT', 'Field-inverting soles. +18% EXP on handstand & planche protocols.'),
  ('hydraulic_hips',  'Hydraulic Hip Actuators', 'waist',  1800, 1.20, 'epic',      'HIPS', 'Micro-actuated hip capsule. +20% EXP on split & mobility work.'),
  ('coolant_sleeve',  'Coolant Sleeve Array',    'wrist',   400, 1.05, 'common',    'COOL', 'Thermal regulation weave. +5% EXP, reduces energy decay rate.')
on conflict (code) do update set
  name = excluded.name, cost = excluded.cost,
  exp_multiplier = excluded.exp_multiplier, description = excluded.description;
