// Czech public holidays 2024-2026
// Reference: Act No. 245/2000 Coll. on public holidays
export interface HolidaySeed {
  titleCs: string;
  titleEn: string;
  date: string; // YYYY-MM-DD
}

function yearHolidays(year: number): HolidaySeed[] {
  return [
    { titleCs: 'Nový rok', titleEn: "New Year's Day", date: `${year}-01-01` },
    { titleCs: 'Velký pátek', titleEn: 'Good Friday', date: easterFriday(year) },
    { titleCs: 'Velikonoční pondělí', titleEn: 'Easter Monday', date: easterMonday(year) },
    { titleCs: 'Svátek práce', titleEn: 'Labour Day', date: `${year}-05-01` },
    { titleCs: 'Den vítězství', titleEn: 'Victory in Europe Day', date: `${year}-05-08` },
    { titleCs: 'Den slovanských věrozvěstů', titleEn: 'Cyril and Methodius Day', date: `${year}-07-05` },
    { titleCs: 'Den upálení Mistra Jana Husa', titleEn: 'Jan Hus Day', date: `${year}-07-06` },
    { titleCs: 'Den české státnosti', titleEn: 'Czech Statehood Day', date: `${year}-09-28` },
    { titleCs: 'Den vzniku Československa', titleEn: 'Czechoslovak Independence Day', date: `${year}-10-28` },
    { titleCs: 'Den boje za svobodu a demokracii', titleEn: 'Struggle for Freedom Day', date: `${year}-11-17` },
    { titleCs: 'Štědrý den', titleEn: 'Christmas Eve', date: `${year}-12-24` },
    { titleCs: '1. svátek vánoční', titleEn: 'Christmas Day', date: `${year}-12-25` },
    { titleCs: '2. svátek vánoční', titleEn: 'St. Stephen\'s Day', date: `${year}-12-26` },
  ];
}

// Computus algorithm for Easter Sunday (Gregorian)
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function easterFriday(year: number): string {
  const d = easter(year);
  d.setDate(d.getDate() - 2);
  return d.toISOString().slice(0, 10);
}

function easterMonday(year: number): string {
  const d = easter(year);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const HOLIDAYS_SEED: HolidaySeed[] = [
  ...yearHolidays(2024),
  ...yearHolidays(2025),
  ...yearHolidays(2026),
  ...yearHolidays(2027),
];

// ─── US Federal Holidays ───────────────────────────────────────────────────

/**
 * Returns the date of the Nth weekday in a given month.
 * weekday: 0=Sun, 1=Mon … 6=Sat
 * n: 1=first, 2=second, -1=last, etc.
 */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  if (n > 0) {
    const d = new Date(year, month - 1, 1);
    const diff = (weekday - d.getDay() + 7) % 7;
    d.setDate(1 + diff + (n - 1) * 7);
    return d.toISOString().slice(0, 10);
  } else {
    // last weekday
    const d = new Date(year, month, 0); // last day of month
    const diff = (d.getDay() - weekday + 7) % 7;
    d.setDate(d.getDate() - diff);
    return d.toISOString().slice(0, 10);
  }
}

function usYearHolidays(year: number): HolidaySeed[] {
  // Use English titles for US holidays — avoids encoding issues and is more natural
  return [
    { titleCs: '🇺🇸 New Year\'s Day',                   titleEn: '🇺🇸 New Year\'s Day',                   date: `${year}-01-01` },
    { titleCs: '🇺🇸 MLK Jr. Day',                       titleEn: '🇺🇸 Martin Luther King Jr. Day',        date: nthWeekday(year, 1, 1, 3) },
    { titleCs: '🇺🇸 Presidents\' Day',                  titleEn: '🇺🇸 Presidents\' Day',                  date: nthWeekday(year, 2, 1, 3) },
    { titleCs: '🇺🇸 Memorial Day',                      titleEn: '🇺🇸 Memorial Day',                      date: nthWeekday(year, 5, 1, -1) },
    { titleCs: '🇺🇸 Juneteenth',                        titleEn: '🇺🇸 Juneteenth National Independence Day', date: `${year}-06-19` },
    { titleCs: '🇺🇸 Independence Day',                  titleEn: '🇺🇸 Independence Day (4th of July)',    date: `${year}-07-04` },
    { titleCs: '🇺🇸 Labor Day',                         titleEn: '🇺🇸 Labor Day',                         date: nthWeekday(year, 9, 1, 1) },
    { titleCs: '🇺🇸 Columbus Day',                      titleEn: '🇺🇸 Columbus Day',                      date: nthWeekday(year, 10, 1, 2) },
    { titleCs: '🇺🇸 Veterans Day',                      titleEn: '🇺🇸 Veterans Day',                      date: `${year}-11-11` },
    { titleCs: '🇺🇸 Thanksgiving',                      titleEn: '🇺🇸 Thanksgiving Day',                  date: nthWeekday(year, 11, 4, 4) },
    { titleCs: '🇺🇸 Christmas Day',                     titleEn: '🇺🇸 Christmas Day',                     date: `${year}-12-25` },
  ];
}

export const US_HOLIDAYS_SEED: HolidaySeed[] = [
  ...usYearHolidays(2024),
  ...usYearHolidays(2025),
  ...usYearHolidays(2026),
  ...usYearHolidays(2027),
];
