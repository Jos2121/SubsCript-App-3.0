// Utility functions to handle dates without timezone issues

/**
 * Format a date string to local date display (dd/mm/yyyy)
 * Handles the date as local date without timezone conversion
 */
export function formatLocalDate(dateString: string): string {
  if (!dateString) return '';
  
  // Parse the date as local date (not UTC)
  const [year, month, day] = dateString.split('T')[0].split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  
  return date.toLocaleDateString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Get the date value for input[type="date"] from a date string
 * Ensures we get YYYY-MM-DD format without timezone issues
 */
export function getInputDateValue(dateString: string): string {
  if (!dateString) return '';
  
  // Return just the date part (YYYY-MM-DD) without time
  return dateString.split('T')[0];
}

/**
 * Get today's date in YYYY-MM-DD format for input[type="date"]
 */
export function getTodayInputValue(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}
