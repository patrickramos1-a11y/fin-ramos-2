import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf8');
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1).replace(/^"|"$/g, '')];
    }),
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

const accountName = process.argv[2] || 'FIXAS';
const year = Number(process.argv[3] || 2026);
const month = Number(process.argv[4] || 1);
const start = `${year}-${String(month).padStart(2, '0')}-01`;
const endDate = new Date(year, month, 0);
const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

async function fetchAll(table, select, build = (q) => q) {
  const out = [];
  let from = 0;
  const size = 1000;
  while (true) {
    let query = supabase.from(table).select(select).range(from, from + size - 1);
    query = build(query);
    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) break;
    out.push(...data);
    if (data.length < size) break;
    from += size;
  }
  return out;
}

const { data: accounts, error: accountError } = await supabase
  .from('accounts')
  .select('id,name')
  .ilike('name', accountName)
  .limit(1);
if (accountError) throw accountError;
const account = accounts?.[0];
if (!account) throw new Error(`Conta nao encontrada: ${accountName}`);

const select =
  'id,descricao,tipo_movimento,status,valor,valor_pago,competencia_mes,competencia_ano,data_vencimento,data_pagamento';
const [competencia, caixa, transfers] = await Promise.all([
  fetchAll('transactions', select, (q) =>
    q.eq('account_id', account.id).eq('competencia_ano', year).eq('competencia_mes', month),
  ),
  fetchAll('transactions', select, (q) =>
    q.eq('account_id', account.id).eq('status', 'PAGO').gte('data_pagamento', start).lte('data_pagamento', end),
  ),
  fetchAll('account_transfers', 'id,from_account_id,to_account_id,amount,transfer_date', (q) =>
    q
      .or(`from_account_id.eq.${account.id},to_account_id.eq.${account.id}`)
      .gte('transfer_date', start)
      .lte('transfer_date', end),
  ),
]);

function summarize(rows) {
  let entradas = 0;
  let saidas = 0;
  for (const row of rows) {
    const value = Number(row.valor_pago ?? row.valor) || 0;
    if (row.tipo_movimento === 'ENTRADA') entradas += value;
    else saidas += value;
  }
  return { itens: rows.length, entradas, saidas, saldo: entradas - saidas };
}

const transferSummary = transfers.reduce(
  (acc, transfer) => {
    const value = Number(transfer.amount) || 0;
    if (transfer.to_account_id === account.id) acc.recebidas += value;
    if (transfer.from_account_id === account.id) acc.enviadas += value;
    return acc;
  },
  { recebidas: 0, enviadas: 0, itens: transfers.length },
);

console.log(
  JSON.stringify(
    {
      account,
      period: { year, month, start, end },
      competencia: summarize(competencia),
      caixa: summarize(caixa),
      transferencias: transferSummary,
      maioresCompetencia: competencia
        .sort((a, b) => (Number(b.valor_pago ?? b.valor) || 0) - (Number(a.valor_pago ?? a.valor) || 0))
        .slice(0, 8)
        .map((t) => ({
          descricao: t.descricao,
          valor: Number(t.valor_pago ?? t.valor) || 0,
          status: t.status,
          vencimento: t.data_vencimento,
          pagamento: t.data_pagamento,
        })),
      maioresCaixa: caixa
        .sort((a, b) => (Number(b.valor_pago ?? b.valor) || 0) - (Number(a.valor_pago ?? a.valor) || 0))
        .slice(0, 8)
        .map((t) => ({
          descricao: t.descricao,
          valor: Number(t.valor_pago ?? t.valor) || 0,
          status: t.status,
          vencimento: t.data_vencimento,
          pagamento: t.data_pagamento,
        })),
    },
    null,
    2,
  ),
);
