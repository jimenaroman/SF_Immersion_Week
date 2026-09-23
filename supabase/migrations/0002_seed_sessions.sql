-- SF Leisure Discovery — seed data: 12 businesses, 29 weekly sessions.
--
-- Re-runnable. Businesses key off their unique name; sessions key off the
-- (business, day, time) slot from 0001, so running this twice is a no-op
-- rather than a duplicate.
--
-- maxed_out is not seeded — it is generated from capacity and attendance.

insert into public.businesses (name, neighborhood, address) values
  ('Valencia Slow Bar',           'Mission',        '1142 Valencia St, San Francisco, CA 94110'),
  ('Linden Lane Studio',          'Hayes Valley',   '318 Linden St, San Francisco, CA 94102'),
  ('Sunset Meadow Collective',    'Inner Sunset',   '1290 9th Ave, San Francisco, CA 94122'),
  ('Cortland Corner Kitchen',     'Bernal Heights', '745 Cortland Ave, San Francisco, CA 94110'),
  ('Clement Street Tasting Room', 'Inner Richmond', '522 Clement St, San Francisco, CA 94118'),
  ('Dogpatch Clay Works',         'Dogpatch',       '2301 Third St, San Francisco, CA 94107'),
  ('Washington Square Neighbors', 'North Beach',    '1555 Stockton St, San Francisco, CA 94133'),
  ('Potrero Hill Stretch Club',   'Potrero Hill',   '1401 18th St, San Francisco, CA 94107'),
  ('Noe Valley Little Ones',      'Noe Valley',     '3920 24th St, San Francisco, CA 94114'),
  ('Alabama Street Social',       'Mission',        '2870 Alabama St, San Francisco, CA 94110'),
  ('Outer Sunset Beach Movers',   'Outer Sunset',   '3809 Judah St, San Francisco, CA 94122'),
  ('Glen Park Reading Room',      'Glen Park',      '690 Chenery St, San Francisco, CA 94131')
on conflict (name) do nothing;

insert into public.sessions
  (business_id, day_of_week, start_time, activity_label, audience_age, capacity, people_attending)
select b.id, v.day_of_week, v.start_time::time, v.activity_label, v.audience_age, v.capacity, v.people_attending
from (values
  -- business                      day          time     activity            audience     cap  going
  ('Valencia Slow Bar',           'Tuesday',   '18:30', 'cafe_hangout',     'adults',    16,  11),
  ('Valencia Slow Bar',           'Saturday',  '10:00', 'cafe_hangout',     'all_ages',  20,  20),
  ('Valencia Slow Bar',           'Thursday',  '08:00', 'cafe_hangout',     'adults',    12,   7),

  ('Linden Lane Studio',          'Wednesday', '19:00', 'class_workshop',   'adults',    10,   8),
  ('Linden Lane Studio',          'Sunday',    '14:00', 'class_workshop',   'teens',     12,   5),

  ('Sunset Meadow Collective',    'Saturday',  '09:30', 'park_event',       'all_ages',  40,  33),
  ('Sunset Meadow Collective',    'Sunday',    '16:00', 'park_event',       'seniors',   25,  14),
  ('Sunset Meadow Collective',    'Friday',    '17:30', 'park_event',       'kids',      30,  28),

  ('Cortland Corner Kitchen',     'Thursday',  '18:00', 'food_tasting',     'adults',    14,   9),
  ('Cortland Corner Kitchen',     'Saturday',  '11:30', 'food_tasting',     'all_ages',  18,  15),

  ('Clement Street Tasting Room', 'Friday',    '19:30', 'food_tasting',     'adults',    12,  12),
  ('Clement Street Tasting Room', 'Sunday',    '13:00', 'food_tasting',     'adults',    16,   6),

  ('Dogpatch Clay Works',         'Saturday',  '13:00', 'arts_craft',       'all_ages',  10,  10),
  ('Dogpatch Clay Works',         'Wednesday', '18:30', 'arts_craft',       'adults',    10,   4),
  ('Dogpatch Clay Works',         'Sunday',    '10:30', 'arts_craft',       'kids',       8,   5),

  ('Washington Square Neighbors', 'Monday',    '17:30', 'community_meetup', 'seniors',   22,  13),
  ('Washington Square Neighbors', 'Saturday',  '15:00', 'community_meetup', 'all_ages',  30,  19),

  ('Potrero Hill Stretch Club',   'Tuesday',   '07:00', 'fitness_casual',   'adults',    15,  10),
  ('Potrero Hill Stretch Club',   'Thursday',  '19:00', 'fitness_casual',   'adults',    15,  12),
  ('Potrero Hill Stretch Club',   'Sunday',    '09:00', 'fitness_casual',   'seniors',   12,   8),

  ('Noe Valley Little Ones',      'Saturday',  '09:00', 'family_playtime',  'kids',      12,  12),
  ('Noe Valley Little Ones',      'Wednesday', '10:00', 'family_playtime',  'kids',      14,   9),

  ('Alabama Street Social',       'Friday',    '18:00', 'community_meetup', 'adults',    25,  17),
  ('Alabama Street Social',       'Monday',    '19:00', 'community_meetup', 'teens',     20,   7),

  ('Outer Sunset Beach Movers',   'Saturday',  '08:00', 'fitness_casual',   'all_ages',  20,  16),
  ('Outer Sunset Beach Movers',   'Tuesday',   '18:00', 'fitness_casual',   'adults',    18,  11),

  ('Glen Park Reading Room',      'Monday',    '16:00', 'cafe_hangout',     'teens',     14,   6),
  ('Glen Park Reading Room',      'Thursday',  '09:30', 'cafe_hangout',     'seniors',   12,   9),
  ('Glen Park Reading Room',      'Sunday',    '11:00', 'cafe_hangout',     'all_ages',  16,  13)
) as v (business_name, day_of_week, start_time, activity_label, audience_age, capacity, people_attending)
join public.businesses b on b.name = v.business_name
on conflict (business_id, day_of_week, start_time) do nothing;
