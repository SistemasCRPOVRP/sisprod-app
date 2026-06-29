import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getPeriodo(date) {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const trimestre = Math.ceil(month / 3);
  return `${year}-T${trimestre}`;
}

export function getCurrentPeriodo() {
  return getPeriodo(new Date());
}

export function getPeriodoLabel(periodo) {
  if (!periodo) return '';
  const [year, t] = periodo.split('-T');
  const labels = { '1': 'Jan–Mar', '2': 'Abr–Jun', '3': 'Jul–Set', '4': 'Out–Dez' };
  return `${labels[t] || ''} ${year}`;
}

export function getAllPeriodos(yearsBack = 5, yearsForward = 1) {
  const currentYear = new Date().getFullYear();
  const periods = [];
  for (let y = currentYear + yearsForward; y >= currentYear - yearsBack; y--) {
    for (let t = 4; t >= 1; t--) {
      periods.push(`${y}-T${t}`);
    }
  }
  return periods;
}

export function formatNumber(num) {
  const n = Number(num);
  if (num == null || isNaN(n)) return '0';
  return n.toLocaleString('pt-BR');
}