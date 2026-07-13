-- Fix event type icon fields that were accidentally set to plain text.
-- The "Tenis" event type was created via the admin UI with icon = 'Tenis'
-- instead of the correct emoji '🎾'.
-- Also normalise the slug so it aligns with the canonical seed (tenis-trening).
UPDATE "EventType"
SET    icon  = '🎾',
       slug  = CASE WHEN slug = 'tenis' THEN 'tenis-trening' ELSE slug END,
       "nameCs" = CASE WHEN slug = 'tenis' THEN 'Trénink tenis' ELSE "nameCs" END,
       "nameEn" = CASE WHEN slug = 'tenis' THEN 'Tennis training' ELSE "nameEn" END
WHERE  icon = 'Tenis'
  AND  slug NOT IN ('tenis-trening', 'tenis-turnaj');

-- Upsert the canonical tennis event types so the seed is idempotent.
-- tenis-trening
INSERT INTO "EventType" (id, slug, "nameCs", "nameEn", icon, color, "groupCs", "groupEn",
                          "defaultDurationMinutes", "defaultReminderMinutes", "sortOrder",
                          "isActive", "createdAt")
VALUES (gen_random_uuid(), 'tenis-trening', 'Trénink tenis', 'Tennis training',
        '🎾', '#84cc16', 'Tenis', 'Tennis', 60, 60, 45, true, now())
ON CONFLICT (slug) DO UPDATE
  SET icon  = EXCLUDED.icon,
      color = EXCLUDED.color,
      "nameCs" = EXCLUDED."nameCs",
      "nameEn" = EXCLUDED."nameEn",
      "sortOrder" = EXCLUDED."sortOrder";

-- tenis-turnaj
INSERT INTO "EventType" (id, slug, "nameCs", "nameEn", icon, color, "groupCs", "groupEn",
                          "defaultDurationMinutes", "defaultReminderMinutes", "sortOrder",
                          "isActive", "createdAt")
VALUES (gen_random_uuid(), 'tenis-turnaj', 'Turnaj tenis', 'Tennis tournament',
        '🏆', '#eab308', 'Tenis', 'Tennis', 240, 1440, 46, true, now())
ON CONFLICT (slug) DO UPDATE
  SET icon  = EXCLUDED.icon,
      color = EXCLUDED.color,
      "nameCs" = EXCLUDED."nameCs",
      "nameEn" = EXCLUDED."nameEn",
      "sortOrder" = EXCLUDED."sortOrder";
