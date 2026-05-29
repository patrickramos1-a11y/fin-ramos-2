import { useState } from 'react';
import {
  ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
  Bar, Line,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/data/mockData';
import type { MonthBucket, Regime } from '@/hooks/useDashboardYTD';

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface Props {
  monthly: MonthBucket[];
  regime: Regime;
  onRegimeChange: (r: Regime) => void;
  onMonthClick?: (month: number) => void;
}

const compact = (v: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

export function MasterEvolutionChart({ monthly, regime, onRegimeChange, onMonthClick }: Props) {
  let acumulado = 0;
  const data = monthly.map((m, i) => {
    acumulado += m.resultado;
    return {
      name: MONTHS[i],
      month: i + 1,
      Receita: m.receita,
      Despesa: m.despesa,
      'Resultado do mês': m.resultado,
      'Resultado acumulado': acumulado,
    };
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base lg:text-lg">Evolução Mensal — resultado acumulado</CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor="regime-evol" className="text-xs text-muted-foreground">
            {regime === 'competencia' ? 'Competência' : 'Caixa'}
          </Label>
          <Switch
            id="regime-evol"
            checked={regime === 'caixa'}
            onCheckedChange={(c) => onRegimeChange(c ? 'caixa' : 'competencia')}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72 lg:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              onClick={(e: any) => {
                if (onMonthClick && e?.activePayload?.[0]?.payload?.month) {
                  onMonthClick(e.activePayload[0].payload.month);
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="name" interval={0} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={compact} tick={{ fontSize: 11 }} width={60} />
              <Tooltip
                formatter={(v: any) => formatCurrency(Number(v))}
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Receita" fill="hsl(var(--income))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesa" fill="hsl(var(--expense))" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="Resultado acumulado"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Clique em um mês para abrir o detalhamento.
        </p>
      </CardContent>
    </Card>
  );
}
