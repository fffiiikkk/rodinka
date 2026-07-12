-- Insert US Federal Holidays 2024-2027
-- Uses the system user as creator
DO $$
DECLARE
  sys_id TEXT;
BEGIN
  SELECT id INTO sys_id FROM "User" WHERE username = 'system' LIMIT 1;

  IF sys_id IS NULL THEN
    RAISE NOTICE 'system user not found, skipping US holiday seed';
    RETURN;
  END IF;

  -- Helper: insert if not duplicate
  -- 2024
  INSERT INTO "Event" (id, title, description, start, "end", "allDay", "isHoliday", status, "createdById", "createdAt", "updatedAt")
  SELECT gen_random_uuid()::text, h.title_cs, h.title_en, h.dt::timestamptz, (h.dt::date + interval '23 hours 59 minutes 59 seconds')::timestamptz, true, true, 'APPROVED', sys_id, now(), now()
  FROM (VALUES
    ('🇺🇸 Nový rok',                            '🇺🇸 New Year''s Day',                          '2024-01-01'),
    ('🇺🇸 Den Martina Luthera Kinga',           '🇺🇸 Martin Luther King Jr. Day',               '2024-01-15'),
    ('🇺🇸 Den prezidentů',                      '🇺🇸 Presidents'' Day',                          '2024-02-19'),
    ('🇺🇸 Den padlých',                         '🇺🇸 Memorial Day',                             '2024-05-27'),
    ('🇺🇸 Juneteenth',                          '🇺🇸 Juneteenth National Independence Day',     '2024-06-19'),
    ('🇺🇸 Den nezávislosti',                    '🇺🇸 Independence Day (4th of July)',            '2024-07-04'),
    ('🇺🇸 Den práce',                           '🇺🇸 Labor Day',                                '2024-09-02'),
    ('🇺🇸 Den Kryštofa Kolumba',                '🇺🇸 Columbus Day',                             '2024-10-14'),
    ('🇺🇸 Den veteránů',                        '🇺🇸 Veterans Day',                             '2024-11-11'),
    ('🇺🇸 Den díkůvzdání',                      '🇺🇸 Thanksgiving Day',                         '2024-11-28'),
    ('🇺🇸 Vánoce',                              '🇺🇸 Christmas Day',                            '2024-12-25'),
    -- 2025
    ('🇺🇸 Nový rok',                            '🇺🇸 New Year''s Day',                          '2025-01-01'),
    ('🇺🇸 Den Martina Luthera Kinga',           '🇺🇸 Martin Luther King Jr. Day',               '2025-01-20'),
    ('🇺🇸 Den prezidentů',                      '🇺🇸 Presidents'' Day',                          '2025-02-17'),
    ('🇺🇸 Den padlých',                         '🇺🇸 Memorial Day',                             '2025-05-26'),
    ('🇺🇸 Juneteenth',                          '🇺🇸 Juneteenth National Independence Day',     '2025-06-19'),
    ('🇺🇸 Den nezávislosti',                    '🇺🇸 Independence Day (4th of July)',            '2025-07-04'),
    ('🇺🇸 Den práce',                           '🇺🇸 Labor Day',                                '2025-09-01'),
    ('🇺🇸 Den Kryštofa Kolumba',                '🇺🇸 Columbus Day',                             '2025-10-13'),
    ('🇺🇸 Den veteránů',                        '🇺🇸 Veterans Day',                             '2025-11-11'),
    ('🇺🇸 Den díkůvzdání',                      '🇺🇸 Thanksgiving Day',                         '2025-11-27'),
    ('🇺🇸 Vánoce',                              '🇺🇸 Christmas Day',                            '2025-12-25'),
    -- 2026
    ('🇺🇸 Nový rok',                            '🇺🇸 New Year''s Day',                          '2026-01-01'),
    ('🇺🇸 Den Martina Luthera Kinga',           '🇺🇸 Martin Luther King Jr. Day',               '2026-01-19'),
    ('🇺🇸 Den prezidentů',                      '🇺🇸 Presidents'' Day',                          '2026-02-16'),
    ('🇺🇸 Den padlých',                         '🇺🇸 Memorial Day',                             '2026-05-25'),
    ('🇺🇸 Juneteenth',                          '🇺🇸 Juneteenth National Independence Day',     '2026-06-19'),
    ('🇺🇸 Den nezávislosti',                    '🇺🇸 Independence Day (4th of July)',            '2026-07-04'),
    ('🇺🇸 Den práce',                           '🇺🇸 Labor Day',                                '2026-09-07'),
    ('🇺🇸 Den Kryštofa Kolumba',                '🇺🇸 Columbus Day',                             '2026-10-12'),
    ('🇺🇸 Den veteránů',                        '🇺🇸 Veterans Day',                             '2026-11-11'),
    ('🇺🇸 Den díkůvzdání',                      '🇺🇸 Thanksgiving Day',                         '2026-11-26'),
    ('🇺🇸 Vánoce',                              '🇺🇸 Christmas Day',                            '2026-12-25'),
    -- 2027
    ('🇺🇸 Nový rok',                            '🇺🇸 New Year''s Day',                          '2027-01-01'),
    ('🇺🇸 Den Martina Luthera Kinga',           '🇺🇸 Martin Luther King Jr. Day',               '2027-01-18'),
    ('🇺🇸 Den prezidentů',                      '🇺🇸 Presidents'' Day',                          '2027-02-15'),
    ('🇺🇸 Den padlých',                         '🇺🇸 Memorial Day',                             '2027-05-31'),
    ('🇺🇸 Juneteenth',                          '🇺🇸 Juneteenth National Independence Day',     '2027-06-19'),
    ('🇺🇸 Den nezávislosti',                    '🇺🇸 Independence Day (4th of July)',            '2027-07-04'),
    ('🇺🇸 Den práce',                           '🇺🇸 Labor Day',                                '2027-09-06'),
    ('🇺🇸 Den Kryštofa Kolumba',                '🇺🇸 Columbus Day',                             '2027-10-11'),
    ('🇺🇸 Den veteránů',                        '🇺🇸 Veterans Day',                             '2027-11-11'),
    ('🇺🇸 Den díkůvzdání',                      '🇺🇸 Thanksgiving Day',                         '2027-11-25'),
    ('🇺🇸 Vánoce',                              '🇺🇸 Christmas Day',                            '2027-12-25')
  ) AS h(title_cs, title_en, dt)
  WHERE NOT EXISTS (
    SELECT 1 FROM "Event" e2
    WHERE e2.title = h.title_cs
      AND date_trunc('day', e2.start) = h.dt::date
      AND e2."isHoliday" = true
  );

  RAISE NOTICE 'US holidays inserted.';
END $$;
