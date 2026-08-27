import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseSAPValue(value: any): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  
  // Clean string and handle European/Portuguese format (124,16)
  let str = String(value).trim().replace(/\s/g, "");
  
  // Logic: if we have points and commas (1.234,56), we should remove the point first
  // But strictly following user's prompt step-by-step:
  if (str.includes(',') && str.includes('.')) {
    // Standard European format: dots are thousands, comma is decimal
    str = str.replace(/\./g, '').replace(',', '.');
  } else {
    // Only one type of separator or none
    str = str.replace(',', '.');
  }
    
  const num = Number(str);
  return isNaN(num) ? 0 : num;
}

export function formatCurrency(value: number | string): string {
  const num = typeof value === 'number' ? value : parseSAPValue(value);
  
  // European format: dot for thousands, comma for decimals
  const formattedNumber = new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(num);

  // Some browsers use spaces for thousands in pt-PT. 
  // The user specifically requested a dot (4.802,17).
  // We'll replace any whitespace or non-breaking whitespace with dots.
  const dotFormatted = formattedNumber.replace(/[\s\u00A0\u202F\u2007]/g, '.');

  return `${dotFormatted} €`;
}

export function getRef3(reference: string | number): string {
  const str = String(reference || '').trim().toUpperCase();

  // G04 ou G04-xxxx
  const alphaMatch = str.match(/^([A-Z]\d{2})/);
  if (alphaMatch) return alphaMatch[1];

  // 049 ou 049-xxxx
  const numericMatch = str.match(/^(\d{3})/);
  if (numericMatch) return numericMatch[1];

  return '';
}
