/**
 * One-time script: delete all existing US holiday rows (broken encoding)
 * and re-insert them from the corrected seed.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { US_HOLIDAYS_SEED } from './holidays.js';

const prisma = new PrismaClient();

async function main() {
  const systemUser = await prisma.user.findFirst({ where: { username: 'system' } });
  if (!systemUser) throw new Error('system user not found');

  // Delete ALL existing holiday rows that were meant to be US holidays
  // (they may have corrupted titles starting with replacement characters)
  const deleted = await prisma.event.deleteMany({
    where: {
      isHoliday: true,
      OR: [
        // Corrupted emoji rows — title starts with replacement char or has ?? 
        { title: { contains: '??' } },
        // Already-correct US rows from previous runs
        { title: { startsWith: '\u{1F1FA}\u{1F1F8}' } }, // 🇺🇸
        // Any row matching known US holiday English names
        { title: { contains: 'Independence Day' } },
        { title: { contains: 'Memorial Day' } },
        { title: { contains: 'Juneteenth' } },
        { title: { contains: 'Thanksgiving' } },
        { title: { contains: 'Labor Day' } },
        { title: { contains: 'Veterans Day' } },
        { title: { contains: 'Columbus Day' } },
        { title: { contains: 'Presidents' } },
        { title: { contains: 'MLK' } },
        { title: { contains: 'Martin Luther King' } },
        { title: { contains: 'Christmas Day' } },
        { title: { contains: 'New Year\'s Day' } },
      ],
    },
  });
  console.log(`Deleted ${deleted.count} old US holiday rows`);

  // Re-insert from corrected seed
  let inserted = 0;
  for (const h of US_HOLIDAYS_SEED) {
    const start = new Date(`${h.date}T00:00:00.000Z`);
    const end   = new Date(`${h.date}T23:59:59.000Z`);
    await prisma.event.create({
      data: {
        title: h.titleCs,
        description: h.titleEn,
        start,
        end,
        allDay: true,
        isHoliday: true,
        status: 'APPROVED',
        createdById: systemUser.id,
      },
    });
    inserted++;
  }
  console.log(`Inserted ${inserted} US holidays`);
  console.log('Done!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
