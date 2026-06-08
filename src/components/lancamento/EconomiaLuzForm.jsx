import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Lightbulb } from 'lucide-react';

function calcPontos(retrasado, anterior, atual) {
  if (!anterior || !atual) return null;
  const varB = parseFloat(atual) - parseFloat(anterior);
  const varA = retrasado ? parseFloat(anterior) - parseFloat(retrasado) : null;
  if (varA === null) return varB < 0 ? 5 : 0;
  return varB < varA ? 5 : 0;
}

export function calcPontosLuz(form) {
  return calcPontos(form.consumoDoisAtrasLuz, form.consumoAnteriorLuz, form.consumoAtualLuz);
}

export function calcDeltaLuz(form) {
  if (!form.consumoAnteriorLuz || !form.consumoAtualLuz) return null;
  const varB = parseFloat(form.consumoAtualLuz) - parseFloat(form.consumoAnteriorLuz);
  const varA = form.consumoDoisAtrasLuz
    ? parseFloat(form.consumoAnteriorLuz) - parseFloat(form.consumoDoisAtrasLuz)
    : null;
  return varA !== null ? varB - varA : varB;
}

export default function EconomiaLuzForm({ form, setForm, mesLabels, validationErrors, loadingHistorico }) {
  const { mesDoisAtrasLabel, mesAnteriorLabel, mesAtualLabel } = mesLabels;
  const pontos = calcPontosLuz(form);

  const varB = form.consumoAnteriorLuz && form.consumoAtualLuz
    ? parseFloat(form.consumoAtualLuz) - parseFloat(form.consumoAnteriorLuz)
    : null;
  const varA = form.consumoDoisAtrasLuz && form.consumoAnteriorLuz
    ? parseFloat(form.consumoAnteriorLuz) - parseFloat(form.consumoDoisAtrasLuz)
    : null;

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-yellow-800 text-sm font-semibold">
        <Lightbulb className="w-4 h-4" /> Consumo de Energia Elétrica (kWh)
      </div>

      {loadingHistorico && (
        <p className="text-xs text-yellow-600 animate-pulse">🔄 Buscando histórico do mês anterior...</p>
      )}

      {/* Mês dois atrás — auto */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Label className="text-xs text-yellow-700">Mês anterior ao anterior ({mesDoisAtrasLabel})</Label>
          {form.consumoDoisAtrasLuz && (
            <span className="text-xs text-green-700 font-medium flex items-center gap-0.5">
              <CheckCircle className="w-3 h-3" /> Auto
            </span>
          )}
        </div>
        <Input
          type="number" min="0" step="0.01"
          value={form.consumoDoisAtrasLuz}
          onChange={e => setForm(f => ({ ...f, consumoDoisAtrasLuz: e.target.value }))}
          placeholder="Ex: 5500 — preenchido automaticamente"
          className={`text-sm ${form.consumoDoisAtrasLuz ? 'bg-green-50 border-green-300' : 'bg-white/60'}`}
        />
      </div>

      {/* Mês anterior — auto */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Label className="text-xs text-yellow-700">Mês anterior ({mesAnteriorLabel}) *</Label>
          {form.consumoAnteriorLuz && (
            <span className="text-xs text-green-700 font-medium flex items-center gap-0.5">
              <CheckCircle className="w-3 h-3" /> Auto
            </span>
          )}
        </div>
        <Input
          type="number" min="0" step="0.01"
          value={form.consumoAnteriorLuz}
          onChange={e => setForm(f => ({ ...f, consumoAnteriorLuz: e.target.value }))}
          placeholder="Ex: 5000"
          className={`text-sm ${form.consumoAnteriorLuz ? 'bg-green-50 border-green-300' : 'bg-white/60'} ${validationErrors?.has('consumoAnteriorLuz') ? 'border-destructive border-2' : ''}`}
        />
        {validationErrors?.has('consumoAnteriorLuz') && (
          <p className="text-xs text-destructive mt-1 font-medium">Este campo é obrigatório</p>
        )}
      </div>

      {/* Mês atual — usuário */}
      <div>
        <Label className="text-xs text-yellow-700">Mês atual ({mesAtualLabel}) *</Label>
        <Input
          type="number" min="0" step="0.01"
          value={form.consumoAtualLuz}
          onChange={e => setForm(f => ({ ...f, consumoAtualLuz: e.target.value }))}
          placeholder="Ex: 4800"
          className={`mt-1 bg-white text-sm font-semibold border-yellow-300 ${validationErrors?.has('consumoAtualLuz') ? 'border-destructive border-2' : ''}`}
        />
        {validationErrors?.has('consumoAtualLuz') && (
          <p className="text-xs text-destructive mt-1 font-medium">Este campo é obrigatório</p>
        )}
      </div>

      {/* Preview variações */}
      {varB !== null && (
        <div className="rounded-md bg-yellow-100 border border-yellow-300 px-3 py-2 text-xs space-y-1.5">
          {varA !== null && (
            <div className="flex items-center justify-between text-yellow-700">
              <span>📊 Variação A ({mesDoisAtrasLabel}→{mesAnteriorLabel}):</span>
              <span className="font-bold">{varA >= 0 ? '+' : ''}{varA.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kWh</span>
            </div>
          )}
          <div className="flex items-center justify-between text-yellow-800 font-semibold">
            <span>📊 Variação B ({mesAnteriorLabel}→{mesAtualLabel}):</span>
            <span className="font-bold">{varB >= 0 ? '+' : ''}{varB.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kWh</span>
          </div>
          {varA !== null && (
            <div className={`pt-1 border-t border-yellow-300 text-[11px] font-semibold ${varB < varA ? 'text-green-700' : 'text-red-600'}`}>
              {varB < varA ? '✓ Tendência melhorou (Var B < Var A)' : '✗ Tendência piorou ou estável'}
            </div>
          )}
        </div>
      )}

      {pontos !== null && (
        <div className={`rounded-md px-3 py-2 flex items-center justify-between ${pontos > 0 ? 'bg-green-100 border border-green-300' : 'bg-red-50 border border-red-200'}`}>
          <span className="text-xs font-medium">{pontos > 0 ? '✓ Tendência de melhora — pontua!' : '✗ Sem melhora na tendência — não pontua'}</span>
          <span className={`text-base font-bold ${pontos > 0 ? 'text-green-800' : 'text-red-600'}`}>{pontos} pts</span>
        </div>
      )}
    </div>
  );
}