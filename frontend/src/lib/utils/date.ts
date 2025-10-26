import {
  format,
  isToday,
  isYesterday,
  formatDistanceToNow,
  parseISO,
} from "date-fns";

/**
 * Format a message timestamp
 * - Today: "h:mm a" (e.g., "2:30 PM")
 * - Yesterday: "Yesterday h:mm a" (e.g., "Yesterday 2:30 PM")
 * - Else: "MMM d, h:mm a" (e.g., "Oct 25, 2:30 PM")
 */
export function formatMessageTimestamp(date: Date | string): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;

  if (isToday(dateObj)) {
    return format(dateObj, "h:mm a");
  }

  if (isYesterday(dateObj)) {
    return format(dateObj, "'Yesterday' h:mm a");
  }

  return format(dateObj, "MMM d, h:mm a");
}

/**
 * Format a session date
 * Format: "MMM d, yyyy h:mm a" (e.g., "Oct 25, 2024 2:30 PM")
 */
export function formatSessionDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return format(dateObj, "MMM d, yyyy h:mm a");
}

/**
 * Get relative time string
 * Format: "2 hours ago", "5 minutes ago", etc.
 */
export function getRelativeTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

