import { isWeekend, parse, differenceInDays, addDays, isSameDay } from 'date-fns';
import { FERIADOS_PORTUGAL } from '../constants/feriados';

export function calcularDiasUteis(dataLançamento: Date | string, dataHoje: Date = new Date()): number {
  if (!dataLançamento) return 0;
  
  let start: Date;
  
  if (typeof dataLançamento === 'string') {
    start = new Date(dataLançamento);
  } else if (dataLançamento instanceof Date) {
    start = dataLançamento;
  } else {
    // Handle cases where SAP might pass something else or nested objects
    start = new Date(String(dataLançamento));
  }
  
  if (!start || isNaN(start.getTime())) {
    // Try parsing common SAP formats if default Date fail (e.g. DD.MM.YYYY)
    if (typeof dataLançamento === 'string' && dataLançamento.includes('.')) {
      const parts = dataLançamento.split('.');
      if (parts.length === 3) {
        start = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    }
  }

  if (isNaN(start.getTime())) return 0;

  let count = 0;
  let current = start;

  // We want to count business days between start and today (exclusive of start, inclusive of today)
  while (current < dataHoje) {
    current = addDays(current, 1);
    if (current > dataHoje && !isSameDay(current, dataHoje)) break;

    const isHoli = FERIADOS_PORTUGAL.some(f => isSameDay(new Date(f), current));
    if (!isWeekend(current) && !isHoli) {
      count++;
    }
  }

  return count;
}
