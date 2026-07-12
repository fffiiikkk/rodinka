import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { EVENT_TYPES_SEED } from './eventTypes.js';
import { BADGES_SEED } from './badges.js';
import { HOLIDAYS_SEED, US_HOLIDAYS_SEED } from './holidays.js';

const prisma = new PrismaClient();

const FLAG_SEEDS = [
  { key: 'badges', enabled: true },
  { key: 'push_notifications', enabled: true },
  { key: 'email_notifications', enabled: true },
  { key: 'sms_notifications', enabled: false },
  { key: 'guest_access', enabled: true },
  { key: 'kid_proposals', enabled: true },
  { key: 'attachments', enabled: true },
  { key: 'reports', enabled: true },
  { key: 'motd', enabled: true },
  { key: 'ics_feed', enabled: true },
  { key: 'weekly_digest', enabled: true },
  { key: 'birthdays_layer', enabled: true },
];

async function main() {
  console.log('🌱 Starting seed...');

  // ── Feature flags ─────────────────────────────────────
  console.log('  → Feature flags');
  for (const flag of FLAG_SEEDS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: flag,
    });
  }

  // ── Event types ───────────────────────────────────────
  console.log('  → Event types');
  for (const et of EVENT_TYPES_SEED) {
    await prisma.eventType.upsert({
      where: { slug: et.slug },
      update: {
        nameCs: et.nameCs,
        nameEn: et.nameEn,
        icon: et.icon,
        color: et.color,
        groupCs: et.groupCs,
        groupEn: et.groupEn,
        defaultDurationMinutes: et.defaultDurationMinutes,
        defaultReminderMinutes: et.defaultReminderMinutes,
        sortOrder: et.sortOrder,
      },
      create: et,
    });
  }
  console.log(`     ${EVENT_TYPES_SEED.length} event types upserted`);

  // ── Badge definitions ─────────────────────────────────
  console.log('  → Badge definitions');
  for (const badge of BADGES_SEED) {
    await prisma.badgeDefinition.upsert({
      where: { key: badge.key },
      update: {
        nameCs: badge.nameCs,
        nameEn: badge.nameEn,
        descriptionCs: badge.descriptionCs,
        descriptionEn: badge.descriptionEn,
        icon: badge.icon,
        category: badge.category,
        ruleType: badge.ruleType,
        metric: badge.metric,
        threshold: badge.threshold,
        tier: badge.tier,
        sortOrder: badge.sortOrder,
      },
      create: badge,
    });
  }
  console.log(`     ${BADGES_SEED.length} badge definitions upserted`);

  // ── Public holidays (CZ + US) ─────────────────────────
  console.log('  → Czech + US public holidays');
  let systemUser = await prisma.user.findFirst({ where: { username: 'system' } });
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        username: 'system',
        passwordHash: await argon2.hash(Math.random().toString(36) + Date.now()),
        name: 'Systém',
        email: 'system@localhost',
        role: 'PARENT',
        isActive: false,
      },
    });
  }

  const allHolidays = [...HOLIDAYS_SEED, ...US_HOLIDAYS_SEED];
  for (const h of allHolidays) {
    const start = new Date(`${h.date}T00:00:00.000Z`);
    const end   = new Date(`${h.date}T23:59:59.000Z`);
    const existing = await prisma.event.findFirst({
      where: { title: h.titleCs, start, isHoliday: true },
    });
    if (!existing) {
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
    }
  }
  console.log(`     CZ: ${HOLIDAYS_SEED.length}, US: ${US_HOLIDAYS_SEED.length} holidays processed`);

  // ── Demo family users ─────────────────────────────────
  console.log('  → Demo users');
  const defaultPassword = await argon2.hash('Admin123!');

  const users = [
    {
      username: 'admin',
      name: 'Filip',
      nickname: 'Filda',
      email: 'admin@rodinka.local',
      role: 'PARENT' as const,
      dateOfBirth: new Date('1985-03-15'),
      theme: 'klasika',
      relationship: 'Tatínek',
    },
    {
      username: 'mama',
      name: 'Kateřina',
      nickname: 'Kačka',
      email: 'mama@rodinka.local',
      role: 'PARENT' as const,
      dateOfBirth: new Date('1987-07-22'),
      theme: 'leto',
      relationship: 'Maminka',
    },
    {
      username: 'babicka',
      name: 'Milena',
      nickname: 'Babička Milena',
      email: 'babicka@rodinka.local',
      role: 'GRANDPARENT' as const,
      dateOfBirth: new Date('1955-11-08'),
      theme: 'les',
      relationship: 'Babička (ze strany táty)',
    },
    {
      username: 'dedecek',
      name: 'Jan',
      nickname: 'Děda Jan',
      email: 'dedecek@rodinka.local',
      role: 'GRANDPARENT' as const,
      dateOfBirth: new Date('1952-08-17'),
      theme: 'klasika',
      relationship: 'Dědeček (ze strany táty)',
    },
    {
      username: 'vlasta',
      name: 'Vlasta',
      nickname: 'Babička Vlasta',
      email: 'vlasta@rodinka.local',
      role: 'GRANDPARENT' as const,
      dateOfBirth: new Date('1958-04-23'),
      theme: 'les',
      relationship: 'Babička (ze strany mámy)',
    },
    {
      username: 'strycjan',
      name: 'Jan',
      nickname: 'Honza',
      email: 'strycjan@rodinka.local',
      role: 'RELATIVE' as const,
      dateOfBirth: new Date('1982-06-10'),
      theme: 'klasika',
      relationship: 'Strýc (Adamův táta)',
    },
    {
      username: 'tetaiveta',
      name: 'Iveta',
      nickname: 'Iva',
      email: 'tetaiveta@rodinka.local',
      role: 'RELATIVE' as const,
      dateOfBirth: new Date('1984-02-28'),
      theme: 'leto',
      relationship: 'Teta (Adamova máma)',
    },
    {
      username: 'michael',
      name: 'Michael',
      nickname: 'Míša',
      email: 'michael@rodinka.local',
      role: 'KID' as const,
      dateOfBirth: new Date('2015-04-10'), // 11 let, hokej
      theme: 'led',
      relationship: 'Syn',
    },
    {
      username: 'jan',
      name: 'Jan',
      nickname: 'Jenda',
      email: 'jan@rodinka.local',
      role: 'KID' as const,
      dateOfBirth: new Date('2017-09-05'), // 8 let, plavání
      theme: 'ocean',
      relationship: 'Syn',
    },
    {
      username: 'adam',
      name: 'Adam',
      nickname: 'Adámek',
      email: 'adam@rodinka.local',
      role: 'KID' as const,
      dateOfBirth: new Date('2016-11-14'), // bratranec
      theme: 'klasika',
      relationship: 'Bratranec',
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        name: u.name,
        nickname: (u as any).nickname ?? null,
        relationship: u.relationship ?? null,
        email: u.email,
      },
      create: { ...u, passwordHash: defaultPassword },
    });
  }
  console.log(`     ${users.length} demo users upserted`);

  // ── Sample availability / unavailability records ───────
  console.log('  → Sample availability records');
  const adminUser   = await prisma.user.findUnique({ where: { username: 'admin' } });       // Filip
  const mamaUser    = await prisma.user.findUnique({ where: { username: 'mama' } });        // Kateřina
  const milenaUser  = await prisma.user.findUnique({ where: { username: 'babicka' } });     // Milena
  const janoUser    = await prisma.user.findUnique({ where: { username: 'dedecek' } });     // Jan (děda)
  const vlastaUser  = await prisma.user.findUnique({ where: { username: 'vlasta' } });      // Vlasta
  const honzaUser   = await prisma.user.findUnique({ where: { username: 'strycjan' } });    // Jan (strýc)
  const ivetaUser   = await prisma.user.findUnique({ where: { username: 'tetaiveta' } });   // Iveta

  const existingCount = await prisma.availability.count();

  if (existingCount === 0 && adminUser && mamaUser && milenaUser && janoUser && vlastaUser && honzaUser && ivetaUser) {
    const records = [
      // Milena + Jan jedou spolu na dovolou (2 týdny, konec července)
      {
        userId: milenaUser.id,
        dateFrom: new Date('2026-07-20T00:00:00'),
        dateTo:   new Date('2026-08-03T23:59:59'),
        status: 'UNAVAILABLE' as const,
        note: 'Dovolená',
      },
      {
        userId: janoUser.id,
        dateFrom: new Date('2026-07-20T00:00:00'),
        dateTo:   new Date('2026-08-03T23:59:59'),
        status: 'UNAVAILABLE' as const,
        note: 'Dovolená',
      },
      // Tatínek — služební cesta
      {
        userId: adminUser.id,
        dateFrom: new Date('2026-07-14T00:00:00'),
        dateTo:   new Date('2026-07-18T23:59:59'),
        status: 'UNAVAILABLE' as const,
        note: 'Pracovní cesta',
      },
      // Maminka — wellness víkend
      {
        userId: mamaUser.id,
        dateFrom: new Date('2026-07-25T00:00:00'),
        dateTo:   new Date('2026-07-27T23:59:59'),
        status: 'UNAVAILABLE' as const,
        note: 'Wellness víkend',
      },
      // Vlasta — dostupná první 2 týdny srpna (letní dovolená)
      {
        userId: vlastaUser.id,
        dateFrom: new Date('2026-08-04T00:00:00'),
        dateTo:   new Date('2026-08-17T23:59:59'),
        status: 'AVAILABLE' as const,
        note: 'Dovolená doma',
      },
      // Tatínek — home office týden, dostupný
      {
        userId: adminUser.id,
        dateFrom: new Date('2026-08-04T00:00:00'),
        dateTo:   new Date('2026-08-07T23:59:59'),
        status: 'AVAILABLE' as const,
        note: 'Práce z domova',
      },
      // Milena — dostupná v září (konec sezóny, nemá práci)
      {
        userId: milenaUser.id,
        dateFrom: new Date('2026-09-01T00:00:00'),
        dateTo:   new Date('2026-09-14T23:59:59'),
        status: 'AVAILABLE' as const,
        note: 'Volný týden',
      },
      // Druhá dovolená tatínka — podzim
      {
        userId: adminUser.id,
        dateFrom: new Date('2026-10-26T00:00:00'),
        dateTo:   new Date('2026-11-01T23:59:59'),
        status: 'UNAVAILABLE' as const,
        note: 'Dovolená',
      },
      // Honza (strýc) — dostupný v srpnu (dovolená, může pomáhat)
      {
        userId: honzaUser.id,
        dateFrom: new Date('2026-08-10T00:00:00'),
        dateTo:   new Date('2026-08-20T23:59:59'),
        status: 'AVAILABLE' as const,
        note: 'Dovolená doma',
      },
      // Iveta (teta) — pracovní cesta
      {
        userId: ivetaUser.id,
        dateFrom: new Date('2026-07-28T00:00:00'),
        dateTo:   new Date('2026-08-01T23:59:59'),
        status: 'UNAVAILABLE' as const,
        note: 'Pracovní cesta',
      },
    ];

    for (const r of records) {
      await prisma.availability.create({ data: r });
    }
    console.log(`     ${records.length} availability records created`);
  } else if (existingCount > 0) {
    console.log(`     Skipped — ${existingCount} records already exist`);
  } else {
    console.log('     Skipped — some users not found');
  }

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
