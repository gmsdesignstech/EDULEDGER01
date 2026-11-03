export type TimetableSettings = {
  startTime: string; endTime: string; periodMinutes: number; shortBreakMinutes: number;
  lunchMinutes: number; periodsPerDay: number; workingDays: number[];
  timezone: string;
};
export type TimetableSlot = { kind: "Period" | "Short Break" | "Lunch" | "Activity"; period?: number; startTime: string; endTime: string };
export const defaultTimetableSettings: TimetableSettings = { startTime: "09:00", endTime: "16:00", periodMinutes: 40, shortBreakMinutes: 15, lunchMinutes: 40, periodsPerDay: 9, workingDays: [1,2,3,4,5,6], timezone: "Asia/Kolkata" };
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
export function timeMinutes(value: string) {
  if (!timePattern.test(value)) throw new Error("Enter a valid time.");
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
export function formatMinutes(value: number) { return `${String(Math.floor(value / 60)).padStart(2,"0")}:${String(value % 60).padStart(2,"0")}`; }
export function validateTimetableSettings(value: TimetableSettings) {
  const start = timeMinutes(value.startTime), end = timeMinutes(value.endTime);
  if (end <= start) throw new Error("School end time must be after start time.");
  if (!Number.isInteger(value.periodMinutes) || value.periodMinutes < 20 || value.periodMinutes > 120) throw new Error("Period duration must be 20–120 minutes.");
  for (const [label, count] of [["Short break", value.shortBreakMinutes], ["Lunch", value.lunchMinutes]] as const)
    if (!Number.isInteger(count) || count < 0 || count > 120) throw new Error(`${label} duration must be 0–120 minutes.`);
  if (!Number.isInteger(value.periodsPerDay) || value.periodsPerDay < 1 || value.periodsPerDay > 15) throw new Error("Number of periods must be 1–15.");
  if (!value.workingDays.length || value.workingDays.some(day => !Number.isInteger(day) || day < 1 || day > 6) || new Set(value.workingDays).size !== value.workingDays.length) throw new Error("Choose valid working days.");
  try { new Intl.DateTimeFormat("en", { timeZone: value.timezone }); } catch { throw new Error("Choose a valid school timezone."); }
  return value;
}
export function timetableSlots(settings: TimetableSettings): TimetableSlot[] {
  validateTimetableSettings(settings);
  const end = timeMinutes(settings.endTime), result: TimetableSlot[] = [];
  let cursor = timeMinutes(settings.startTime);
  const add = (kind: TimetableSlot["kind"], length: number, period?: number) => {
    if (!length) return;
    if (cursor + length > end) throw new Error("School hours cannot fit all periods and breaks. Reduce period or break duration, or select a later closing time.");
    result.push({ kind, period, startTime: formatMinutes(cursor), endTime: formatMinutes(cursor + length) });
    cursor += length;
  };
  for (let number = 1; number <= settings.periodsPerDay; number++) {
    add("Period", settings.periodMinutes, number);
    if (number === 2 && number < settings.periodsPerDay) add("Short Break", settings.shortBreakMinutes);
    if (number === 5 && number < settings.periodsPerDay) add("Lunch", settings.lunchMinutes);
  }
  if (cursor < end) add("Activity", end - cursor);
  return result;
}
