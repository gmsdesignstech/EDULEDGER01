export type StaffAttendanceStatus = "Present" | "Absent" | "Late" | "Half Day" | "On Leave" | "Holiday" | "Work From Home";

export const staffAttendanceStatuses: StaffAttendanceStatus[] = ["Present", "Absent", "Late", "Half Day", "On Leave", "Holiday", "Work From Home"];

export function validDate(value: string) {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("Enter a valid attendance date.");
  return value;
}

export function validTime(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("Enter a valid time in HH:mm format.");
  return value;
}

export function validTimezone(value: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return value; }
  catch { throw new Error("Select a valid school timezone."); }
}

export function schoolParts(instant: Date, timeZone: string) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(instant).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

export function zonedInstant(date: string, time: string, timeZone: string) {
  validDate(date); validTime(time); validTimezone(timeZone);
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wall;
  for (let attempt = 0; attempt < 3; attempt++) {
    const local = schoolParts(new Date(instant), timeZone);
    const [ly, lm, ld] = local.date.split("-").map(Number);
    const [lh, lmin] = local.time.split(":").map(Number);
    const difference = Date.UTC(ly, lm - 1, ld, lh, lmin) - wall;
    if (difference === 0) break;
    instant -= difference;
  }
  if (schoolParts(new Date(instant), timeZone).date !== date || schoolParts(new Date(instant), timeZone).time !== time) throw new Error("This local time is unavailable in the selected timezone.");
  return new Date(instant);
}

export function nextDate(value: string) {
  const date = new Date(`${validDate(value)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function previousDate(value: string) {
  const date = new Date(`${validDate(value)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function workingMinutes(checkIn: Date | null, checkOut: Date | null, breakMinutes: number) {
  if (!checkIn || !checkOut) return null;
  const elapsed = Math.round((checkOut.getTime() - checkIn.getTime()) / 60000);
  if (elapsed < 0 || elapsed > 36 * 60) throw new Error("Checkout must be after check-in and within 36 hours.");
  return Math.max(0, elapsed - breakMinutes);
}
