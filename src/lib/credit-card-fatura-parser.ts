import * as XLSX from 'xlsx';

export type CreditCardTransaction = {
  date: string;
  description: string;
  value: number;
  scope: 'nacional' | 'internacional';
  country?: string;
  usdValue?: number;
  fxRate?: number;
  installment?: string;
  categoryHint?: string;
};

export type CreditCardStatementCard = {
  id: string;
  name: string;
  finalDigits: string;
  type: string;
  transactions: CreditCardTransaction[];
  totalNacional: number;
  totalInternacional: number;
  total: number;
};

export type ParsedCreditCardStatement = {
  cards: CreditCardStatementCard[];
  meta: {
    holder?: string;
    agency?: string;
    account?: string;
    updatedAt?: string;
    invoice?: string;
    totalFatura?: number;
    totalNacional?: number;
    totalInternacional?: number;
    totalEncargos?: number;
  };
};

const CARD_HEADER_RE = /^(.+?)\s*-\s*final\s+(\d{3,5})\s*\((titular|adicional)\)/i;
const INSTALLMENT_RE = /\s(\d{2}\/\d{2})\s*$/;

export function normalizeCardDescription(desc: string) {
  return desc
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function suggestCreditCardCategory(desc: string): string {
  const d = normalizeCardDescription(desc);
  if (/(ifood|restaurante|lanche|acai|pizza|burger|peixaria|frutas|padaria|panificadora|conveniencia|supermercado|mercadao|atacadao|mercantil)/.test(d)) return 'Alimentação';
  if (/(uber|99app|posto|combust|gasolina|estacion|transport|taxi)/.test(d)) return 'Transporte';
  if (/(amazon|mercado livre|shopee|magalu|americanas|lojas|reserva|cea)/.test(d)) return 'Compras / Varejo';
  if (/(netflix|spotify|prime|xbox|apple|google|microsoft|claude|openai|chatgpt|lovable|airbnb)/.test(d)) return 'Assinaturas / Digital';
  if (/(unimed|drog|farm|hospital|medic|saude|odonto)/.test(d)) return 'Saúde';
  if (/(azul|latam|gol|hotel|booking)/.test(d)) return 'Viagem';
  if (/(vivo|claro|tim|equatorial|conta|aws|hosting|cloud)/.test(d)) return 'Serviços / Contas';
  if (/(seguro|hdi|anuidade|estorno|pagamento efetuado|iof|encargo|juros)/.test(d)) return 'Tarifas / Financeiro';
  if (/(performe|sportfit|suplemento|academia)/.test(d)) return 'Educação / Fitness';
  return 'Outros';
}

function normalizeDate(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) {
    return `${String(v.getDate()).padStart(2, '0')}/${String(v.getMonth() + 1).padStart(2, '0')}/${v.getFullYear()}`;
  }
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s;
}

export function brDateToISO(date: string, fallbackYear: number): string | null {
  const [day, month, year] = date.split('/').map(Number);
  if (!day || !month) return null;
  const y = year || fallbackYear;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseValue(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function cardKey(digits: string, type: string) {
  return `${digits}-${type.toLowerCase()}`;
}

export async function parseCreditCardStatementFile(file: File): Promise<ParsedCreditCardStatement> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });

  const meta: ParsedCreditCardStatement['meta'] = {};
  const cardsMap = new Map<string, CreditCardStatementCard>();
  const order: string[] = [];
  let section: 'nacional' | 'internacional' | 'encargos' | null = null;
  let current: CreditCardStatementCard | null = null;
  let inTable = false;
  let intlPending: { date: string; fxRate: number } | null = null;
  let intlTx: CreditCardTransaction | null = null;

  const getOrCreateCard = (name: string, digits: string, type: string): CreditCardStatementCard => {
    const key = cardKey(digits, type);
    let card = cardsMap.get(key);
    if (!card) {
      card = { id: key, name, finalDigits: digits, type: type.toLowerCase(), transactions: [], totalNacional: 0, totalInternacional: 0, total: 0 };
      cardsMap.set(key, card);
      order.push(key);
    }
    return card;
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const c0 = row[0] != null ? String(row[0]).trim() : '';
    const c1 = row[1] != null ? String(row[1]).trim() : '';
    const c3raw = row[3];
    if (!c0 && !c1 && c3raw == null) continue;

    if (/^Atualização:/i.test(c0)) { meta.updatedAt = c1; continue; }
    if (/^Nome:/i.test(c0)) { meta.holder = c1; continue; }
    if (/^Agência:/i.test(c0)) { meta.agency = c1; continue; }
    if (/^Conta:/i.test(c0)) { meta.account = c1; continue; }
    if (/^fatura de/i.test(c0)) { meta.invoice = c0; continue; }

    if (/^lan[çc]amentos\s+nacionais/i.test(c0)) {
      section = 'nacional'; current = null; inTable = false; intlPending = null; intlTx = null;
      continue;
    }
    if (/^lan[çc]amentos\s+internacionais/i.test(c0)) {
      section = 'internacional'; current = null; inTable = false; intlPending = null; intlTx = null;
      continue;
    }
    if (/^encargos\s+e\s+servi[çc]os/i.test(c0)) {
      section = 'encargos'; current = null; inTable = false; intlPending = null; intlTx = null;
      continue;
    }

    if (/^total de lan[çc]amentos nacionais/i.test(c0)) { meta.totalNacional = parseValue(c3raw) ?? meta.totalNacional; continue; }
    if (/^total de lan[çc]amentos internacionais/i.test(c0)) { meta.totalInternacional = parseValue(c3raw) ?? meta.totalInternacional; continue; }
    if (/^total encargos e servi[çc]os/i.test(c0)) { meta.totalEncargos = parseValue(c3raw) ?? meta.totalEncargos; continue; }
    if (/^total \(nacionais/i.test(c0)) { meta.totalFatura = parseValue(c3raw) ?? meta.totalFatura; continue; }

    const header = c0.match(CARD_HEADER_RE);
    if (header) {
      current = getOrCreateCard(header[1].trim(), header[2], header[3]);
      inTable = false; intlPending = null; intlTx = null;
      continue;
    }

    if (current && /^data$/i.test(c0) && /lan[çc]amento/i.test(c1)) {
      inTable = true;
      continue;
    }

    if (/^total nacional do cart[ãa]o/i.test(c0)) {
      if (current) current.totalNacional = parseValue(c3raw) ?? current.totalNacional;
      inTable = false;
      continue;
    }
    if (/^total internacional do cart[ãa]o/i.test(c0)) {
      if (current) current.totalInternacional = parseValue(c3raw) ?? current.totalInternacional;
      inTable = false; intlPending = null; intlTx = null;
      continue;
    }
    if (/^total de retirada/i.test(c0) || /^iof\s*-\s*transa[çc]/i.test(c0)) continue;
    if (!current || !inTable) continue;

    const val = parseValue(c3raw);
    if (section === 'internacional') {
      if (c0 && /d[óo]lar de convers[ãa]o/i.test(c1)) {
        intlPending = { date: normalizeDate(row[0]), fxRate: val ?? 0 };
        intlTx = null;
        continue;
      }
      if (/^valor em d[óo]lar$/i.test(c1) && val != null && intlTx) {
        intlTx.usdValue = val;
        continue;
      }
      if (intlTx && row[0] === '' && c1 && val != null) {
        intlTx.country = c1;
        intlTx = null;
        continue;
      }
      if ((row[0] === null || row[0] === undefined) && c1 && val != null && intlPending && !intlTx) {
        const inst = c1.match(INSTALLMENT_RE);
        intlTx = {
          date: intlPending.date,
          description: c1,
          value: val,
          scope: 'internacional',
          fxRate: intlPending.fxRate,
          installment: inst ? inst[1] : undefined,
          categoryHint: suggestCreditCardCategory(c1),
        };
        current.transactions.push(intlTx);
      }
      continue;
    }

    const date = normalizeDate(row[0]);
    if (date && c1 && val != null) {
      const inst = c1.match(INSTALLMENT_RE);
      current.transactions.push({
        date,
        description: c1,
        value: val,
        scope: 'nacional',
        installment: inst ? inst[1] : undefined,
        categoryHint: suggestCreditCardCategory(c1),
      });
    }
  }

  const cards = order.map(k => cardsMap.get(k)!).filter(Boolean);
  for (const card of cards) {
    if (!card.totalNacional) card.totalNacional = card.transactions.filter(t => t.scope === 'nacional').reduce((sum, t) => sum + t.value, 0);
    if (!card.totalInternacional) card.totalInternacional = card.transactions.filter(t => t.scope === 'internacional').reduce((sum, t) => sum + t.value, 0);
    card.total = card.totalNacional + card.totalInternacional;
    card.transactions.sort((a, b) => a.date.localeCompare(b.date));
  }

  return { cards, meta };
}

