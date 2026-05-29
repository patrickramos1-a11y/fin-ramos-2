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
const year = Number(process.argv[2] || new Date().getFullYear());

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

const sum = (items, pick) => items.reduce((total, item) => total + (Number(pick(item)) || 0), 0);

const [tx, transfers, accounts, planned, paidAll, allTransfers] = await Promise.all([
  fetchAll(
    'transactions',
    'id,tipo_movimento,natureza,origem,status,valor,valor_pago,competencia_mes,competencia_ano,data_pagamento,data_vencimento,account_id',
    (q) => q.eq('competencia_ano', year),
  ),
  fetchAll(
    'account_transfers',
    'id,from_account_id,to_account_id,amount,transfer_date,planned_occurrence_id',
    (q) => q.gte('transfer_date', `${year}-01-01`).lte('transfer_date', `${year}-12-31`),
  ),
  fetchAll('accounts', 'id,name,initial_balance,current_balance,active', (q) => q.eq('active', true)),
  fetchAll('planned_transfers', 'id,amount,notes,status', (q) => q.eq('status', 'ATIVO')),
  fetchAll(
    'transactions',
    'id,tipo_movimento,status,valor,valor_pago,account_id,data_pagamento',
    (q) => q.eq('status', 'PAGO').not('account_id', 'is', null),
  ),
  fetchAll('account_transfers', 'from_account_id,to_account_id,amount,transfer_date'),
]);

const receita = sum(tx.filter((t) => t.tipo_movimento === 'ENTRADA'), (t) => t.valor);
const despesa = sum(tx.filter((t) => t.tipo_movimento === 'SAIDA'), (t) => t.valor);
const receitaPaga = sum(
  tx.filter((t) => t.tipo_movimento === 'ENTRADA' && t.status === 'PAGO'),
  (t) => t.valor_pago ?? t.valor,
);
const despesaPaga = sum(
  tx.filter((t) => t.tipo_movimento === 'SAIDA' && t.status === 'PAGO'),
  (t) => t.valor_pago ?? t.valor,
);

const byAccount = new Map(
  accounts.map((account) => [
    account.id,
    {
      name: account.name,
      initial: Number(account.initial_balance) || 0,
      stored: Number(account.current_balance) || 0,
      computed: Number(account.initial_balance) || 0,
    },
  ]),
);

for (const t of paidAll) {
  const account = byAccount.get(t.account_id);
  if (!account) continue;
  const value = Number(t.valor_pago ?? t.valor) || 0;
  account.computed += t.tipo_movimento === 'ENTRADA' ? value : -value;
}

for (const transfer of allTransfers) {
  const value = Number(transfer.amount) || 0;
  const to = byAccount.get(transfer.to_account_id);
  const from = byAccount.get(transfer.from_account_id);
  if (to) to.computed += value;
  if (from) from.computed -= value;
}

const drifts = [...byAccount.values()]
  .map((account) => ({ ...account, drift: account.computed - account.stored }))
  .filter((account) => Math.abs(account.drift) > 0.01)
  .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift));

const plannedExpense = planned.filter((p) => /\[\[ACCOUNTING_MODE:AS_EXPENSE\]\]/.test(p.notes || ''));
const plannedOnly = planned.filter((p) => !/\[\[ACCOUNTING_MODE:AS_EXPENSE\]\]/.test(p.notes || ''));

const monthly = Array.from({ length: 12 }, (_, idx) => ({
  month: idx + 1,
  receita: 0,
  despesa: 0,
  resultado: 0,
  receitaPaga: 0,
  despesaPaga: 0,
  resultadoPago: 0,
  transferenciasExecutadas: 0,
}));

for (const t of tx) {
  const bucket = monthly[(t.competencia_mes || 1) - 1];
  if (!bucket) continue;
  const value = Number(t.valor) || 0;
  const paidValue = Number(t.valor_pago ?? t.valor) || 0;
  if (t.tipo_movimento === 'ENTRADA') {
    bucket.receita += value;
    if (t.status === 'PAGO') bucket.receitaPaga += paidValue;
  } else {
    bucket.despesa += value;
    if (t.status === 'PAGO') bucket.despesaPaga += paidValue;
  }
  bucket.resultado = bucket.receita - bucket.despesa;
  bucket.resultadoPago = bucket.receitaPaga - bucket.despesaPaga;
}

for (const transfer of transfers) {
  const bucket = monthly[Number(transfer.transfer_date.slice(5, 7)) - 1];
  if (!bucket) continue;
  bucket.transferenciasExecutadas += Number(transfer.amount) || 0;
}

const output = {
  year,
  competencia: {
    receita,
    despesa,
    resultado: receita - despesa,
    quantidadeTransacoes: tx.length,
  },
  caixaPago: {
    receita: receitaPaga,
    despesa: despesaPaga,
    resultado: receitaPaga - despesaPaga,
  },
  transferenciasExecutadasNoAno: {
    movimentadoEntreContas: sum(transfers, (t) => t.amount),
    efeitoNoCaixaConsolidado: 0,
    quantidade: transfers.length,
  },
  contas: {
    saldoInicialTotal: sum(accounts, (a) => a.initial_balance),
    saldoAtualRegistrado: sum(accounts, (a) => a.current_balance),
    saldoRecalculadoPorHistorico: sum([...byAccount.values()], (a) => a.computed),
    divergenciaTotal: sum([...byAccount.values()], (a) => a.computed - a.stored),
    contasComDivergencia: drifts.length,
    maioresDivergencias: drifts.slice(0, 15),
  },
  planejadasAtivas: {
    provisionadasComoDespesa: plannedExpense.length,
    somenteTransferencia: plannedOnly.length,
  },
  mensal: monthly,
};

console.log(JSON.stringify(output, null, 2));
