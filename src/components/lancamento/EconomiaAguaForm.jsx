import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Droplets } from 'lucide-react';

// Regra: 5 pts se Var B < Var A (tendência melhorou), senão 0
function calcPontos(retrasado, anterior, atual) {
  if (!anterior || !atual) return null;
  const varB = parseFloat(atual) - parseFloat(anterior);
  const varA = retrasado ? parseFloat(anterior) - parseFloat(retrasado) : null;
  if (varA === null) return varB < 0 ? 5 : 0;
  return varB < varA ? 5 : 0;
}

export function calcPontosAgua(form) {
  return calcPontos(form.consumoDoisAtrasAgua, form.consumoAnteriorAgua, form.consumoAtualAgua);
}

export function calcDeltaAgua(form) {
  if (!form.consumoAnteriorAgua || !form.consumoAtualAgua) return null;
  const varB = parseFloat(form.consumoAtualAgua) - parseFloat(form.consumoAnteriorAgua);
  const varA = form.consumoDoisAtrasAgua
    ? parseFloat(form.consumoAnteriorAgua) - parseFloat(form.consumoDoisAtrasAgua)
    : null;
  return varA !== null ? varB - varA : varB;
}

export default function EconomiaAguaForm({ form, setForm, mesLabels, validationErrors, loadingHistorico }) {
  const { mesDoisAtrasLabel, mesAnteriorLabel, mesAtualLabel } = mesLabels;
  const pontos = calcPontosAgua(form);

  const varB = form.consumoAnteriorAgua && form.consumoAtualAgua
    ? parseFloat(form.consumoAtualAgua) - parseFloat(form.consumoAnteriorAgua)
    : null;
  const varA = form.consumoDoisAtrasAgua && form.consumoAnteriorAgua
    ? parseFloat(form.consumoAnteriorAgua) - parseFloat(form.consumoDoisAtrasAgua)
    : null;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-blue-800 text-sm font-semibold">
        <Droplets className="w-4 h-4" /> Consumo de Água (m³)
      </div>

      {loadingHistorico && (
        <p className="text-xs text-blue-600 animate-pulse">🔄 Buscando histórico do mês anterior...</p>
      )}

      {/* Mês dois atrás — auto */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Label className="text-xs text-blue-700">Mês anterior ao anterior ({mesDoisAtrasLabel})</Label>
          {form.consumoDoisAtrasAgua && (
            <span className="text-xs text-green-700 font-medium flex items-center gap-0.5">
              <CheckCircle className="w-3 h-3" /> Auto
            </span>
          )}
        </div>
        <Input
          type="number" min="0" step="0.01"
          value={form.consumoDoisAtrasAgua}
          onChange={e => setForm(f => ({ ...f, consumoDoisAtrasAgua: e.target.value }))}
          placeholder="Ex: 1300 — preenchido automaticamente"
          className={`text-sm ${form.consumoDoisAtrasAgua ? 'bg-green-50 border-green-300' : 'bg-white/60'}`}
        />
      </div>

      {/* Mês anterior — auto */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Label className="text-xs text-blue-700">Mês anterior ({mesAnteriorLabel}) *</Label>
          {form.consumoAnteriorAgua && (
            <span className="text-xs text-green-700 font-medium flex items-center gap-0.5">
              <CheckCircle className="w-3 h-3" /> Auto
            </span>
          )}
        </div>
        <Input
          type="number" min="0" step="0.01"
          value={form.consumoAnteriorAgua}
          onChange={e => setForm(f => ({ ...f, consumoAnteriorAgua: e.target.value }))}
          placeholder="Ex: 1200"
          className={`text-sm ${form.consumoAnteriorAgua ? 'bg-green-50 border-green-300' : 'bg-white/60'} ${validationErrors?.has('consumoAnteriorAgua') ? 'border-destructive border-2' : ''}`}
        />
        {validationErrors?.has('consumoAnteriorAgua') && (
          <p className="text-xs text-destructive mt-1 font-medium">Este campo é obrigatório</p>
        )}
      </div>

      {/* Mês atual — usuário */}
      <div>
        <Label className="text-xs text-blue-700">Mês atual ({mesAtualLabel}) *</Label>
        <Input
          type="number" min="0" step="0.01"
          value={form.consumoAtualAgua}
          onChange={e => setForm(f => ({ ...f, consumoAtualAgua: e.target.value }))}
          placeholder="Ex: 1100"
          className={`mt-1 bg-white text-sm font-semibold border-blue-300 ${validationErrors?.has('consumoAtualAgua') ? 'border-destructive border-2' : ''}`}
        />
        {validationErrors?.has('consumoAtualAgua') && (
          <p className="text-xs text-destructive mt-1 font-medium">Este campo é obrigatório</p>
        )}
      </div>

      {/* Preview variações */}
      {varB !== null && (
        <div className="rounded-md bg-blue-100 border border-blue-300 px-3 py-2 text-xs space-y-1.5">
          {varA !== null && (
            <div className="flex items-center justify-between text-blue-700">
              <span>📊 Variação A ({mesDoisAtrasLabel}→{mesAnteriorLabel}):</span>
              <span className="font-bold">{varA >= 0 ? '+' : ''}{varA.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m³</span>
            </div>
          )}
          <div className="flex items-center justify-between text-blue-800 font-semibold">
            <span>📊 Variação B ({mesAnteriorLabel}→{mesAtualLabel}):</span>
            <span className="font-bold">{varB >= 0 ? '+' : ''}{varB.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m³</span>
          </div>
          {varA !== null && (
            <div className={`pt-1 border-t border-blue-300 text-[11px] font-semibold ${varB < varA ? 'text-green-700' : 'text-red-600'}`}>
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
