import { isPast, parseISO } from "date-fns";

export function isDateExpired(value?: string): boolean {
  if (!value) {
    return false;
  }

  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return isPast(date);
}
