import { Building2, CircleDollarSign, Landmark, Wallet, type LucideIcon } from 'lucide-react';

export interface BankBrand {
  name: string;
  shortName: string;
  color: string;
  bg: string;
  icon: LucideIcon;
}

const normalize = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function getBankBrand(name?: string | null, fallbackColor?: string | null): BankBrand {
  const normalized = normalize(name);

  if (normalized.includes('inter')) {
    return {
      name: 'Banco Inter',
      shortName: 'Inter',
      color: '#ff7a00',
      bg: '#fff3e8',
      icon: Landmark,
    };
  }

  if (normalized.includes('xp')) {
    return {
      name: 'XP Investimento',
      shortName: 'XP',
      color: '#111827',
      bg: '#f3f4f6',
      icon: CircleDollarSign,
    };
  }

  if (normalized.includes('binance')) {
    return {
      name: 'Binance',
      shortName: 'Binance',
      color: '#f0b90b',
      bg: '#fff8db',
      icon: CircleDollarSign,
    };
  }

  if (normalized.includes('dubai')) {
    return {
      name: 'Dubai',
      shortName: 'Dubai',
      color: '#0f766e',
      bg: '#e6fffb',
      icon: Building2,
    };
  }

  const color = fallbackColor || '#10b981';
  return {
    name: name || 'Sem agrupador',
    shortName: name || 'Sem agrupador',
    color,
    bg: `${color}18`,
    icon: Wallet,
  };
}
