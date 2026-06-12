import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Upload, RefreshCw, CheckCircle2, AlertTriangle, Plus, Minus,
  ArrowRight, Loader2, FileText, X, ChevronDown, ChevronRight,
  Building2, Users, User, Shield
} from 'lucide-react';
import { uploadFile } from '@/api/base44Client';
import { toast } from 'sonner';

// ── Identifica o tipo da linha pelo padrão textual ──────────────────────────
function detectTipo(texto) {
  const t = texto.trim();
  if (/CRPM|CRPO|COMANDO REGIONAL/i.test(t)) return 'crpm';
  if (/\d+[ºo°]?\s*BPM/i.test(t)) return 'btl';
  if (/\d+[aª]?\s*CIA|COMPANHIA/i.test(t)) return 'cia';
  if (/\d+[oº°]?\s*PEL(?:OT[ÃA]O)?/i.test(t)) return 'pel';
  if (/\d+[aª]?\s*GPM/i.test(t)) return 'gpm';
  return null;
}

function extrairLocal(texto) {
  const m = texto.match(/[-–—]\s*(.+)$/) || texto.match(/\(([^)]+)\)$/);
  return m ? m[1].trim() : '';
}

function normalizarNome(texto) {
  return texto
    .replace(/[-–—]\s*.+$/, '')
    .replace(/\([^)]+\)$/, '')
    .trim();
}

function interpretarTexto(texto) {
  const linhas = texto.split('\n').map(l => l.trimEnd()).filter(l => l.trim());
  const raizIdx = linhas.findIndex(l => detectTipo(l) === 'crpm');
  const inicio = raizIdx >= 0 ? raizIdx : 0;
  const itens = linhas.slice(inicio).map(linha => {
    const tipo = detectTipo(linha);
    if (!tipo) return null;
    const indent = linha.match(/^(\s*)/)?.[1]?.length || 0;
    const nome = normalizarNome(linha);
    const local = extrairLocal(linha);
    return { tipo, nome, local, indent };
  }).filter(Boolean);
  if (itens.length === 0) return null;
  const raiz = { ...itens[0], filhos: [] };
  const pilha = [{ node: raiz, indent: itens[0].indent }];
  for (let i = 1; i < itens.length; i++) {
    const item = itens[i];
    while (pilha.length > 1 && pilha[pilha.length - 1].indent >= item.indent) pilha.pop();
    const pai = pilha[pilha.length - 1].node;
    if (!pai.filhos) pai.filhos = [];
    const novoNo = { tipo: item.tipo, nome: item.nome, local: item.local, filhos: item.tipo !== 'gpm' ? [] : undefined };
    pai.filhos.push(novoNo);
    if (item.tipo !== 'gpm') pilha.push({ node: novoNo, indent: item.indent });
  }
  return raiz;
}

function calcDiff(atual, novo) {
  const diff = { adicionados: [], alterados: [], removidos: [] };
  function mapNodes(node, path = []) {
    const m = new Map();
    m.set(path.join('|') || 'root', { nome: node.nome, local: node.local, tipo: node.tipo });
    (node.filhos || []).forEach((f, i) => {
      mapNodes(f, [...path, f.nome]).forEach((v, k) => m.set(k, v));
    });
    return m;
  }
  const atualMap = mapNodes(atual);
  const novoMap = mapNodes(novo);
  novoMap.forEach((v, k) => {
    if (!atualMap.has(k)) diff.adicionados.push({ path: k, ...v });
    else {
      const a = atualMap.get(k);
      if (a.local !== v.local || a.tipo !== v.tipo) diff.alterados.push({ path: k, de: a, para: v });
    }
  });
  atualMap.forEach((v, k) => { if (!novoMap.has(k)) diff.removidos.push({ path: k, ...v }); });
  return diff;
}

function PreviewNode({ node, depth = 0 }) {
  const [open, setOpen] = useState(depth < 2);
  const hasFilhos = node.filhos && node.filhos.length > 0;
  const icons = {
    crpm: <Shield className="w-3.5 h-3.5 text-yellow-600 flex-shrink-0" />,
    btl:  <Building2 className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />,
    cia:  <Building2 className="w-3 h-3 text-green-600 flex-shrink-0" />,
    pel:  <Users className="w-3 h-3 text-blue-500 flex-shrink-0" />,
    gpm:  <User className="w-2.5 h-2.5 text-gray-500 flex-shrink-0" />,
  };
  return (
    <div className={depth > 0 ? 'ml-4 border-l border-border/40 pl-2' : ''}>
      <div className="flex items-center gap-1.5 py-0.5 cursor-pointer group" onClick={() => hasFilhos && setOpen(o => !o)}>
        {hasFilhos ? (open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />) : <span className="w-3" />}
        {icons[node.tipo] || icons.gpm}
        <span className="text-xs font-medium">{node.nome}</span>
        {node.local && <span className="text-[10px] text-muted-foreground">· {node.local}</span>}
        {hasFilhos && <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">({node.filhos.length})</span>}
      </div>
      {open && hasFilhos && node.filhos.map((f, i) => <PreviewNode key={`${f.nome}-${i}`} node={f} depth={depth + 1} />)}
    </div>
  );
}

// ── Converte arquivo PDF para base64 ────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Chama a API da Anthropic diretamente com o PDF em base64 ────────────────
async function invocarLLMComPDF(base64Data) {
  const promptText = 'Voce e um especialista em organogramas militares da Brigada Militar do RS. '
    + 'Analise o PDF do organograma e extraia TODA a estrutura hierarquica completa. '
    + 'REGRAS: Identifique os niveis CRPM/Comando, BPM Batalhao, CIA Companhia, Pelotao, GPM. '
    + 'Para cada unidade identifique o municipio/local sede. '
    + 'Nao invente unidades que nao estejam no PDF. GPMs nao possuem filhos. '
    + 'Retorne APENAS um JSON puro sem markdown com campos: nome, local, tipo e filhos. '
    + 'Tipos validos: crpm, btl, cia, pel, gpm. Retorne APENAS o JSON.';

  const docItem = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } };
  const textItem = { type: 'text', text: promptText };
  const userMessage = { role: 'user', content: [docItem, textItem] };
  const requestBody = { model: 'claude-sonnet-4-6', max_tokens: 4000, messages: [userMessage] };

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) throw new Error('Erro ao chamar a API de IA');
  const data = await response.json();
  const texto = data.content?.find(c => c.type === 'text')?.text || '';
  return texto.replace(/```json|```/g, '').trim();
}

export default function AtualizarOrganogramaDialog({ open, onClose, pdfUrl, organogramaAtual, onConfirmar }) {
  const [etapa, setEtapa] = useState('idle');
  const [progresso, setProgresso] = useState('');
  const [novoOrganograma, setNovoOrganograma] = useState(null);
  const [diff, setDiff] = useState(null);
  const [erroMsg, setErroMsg] = useState('');
  const fileRef = useRef(null);
  const [pdfBase64, setPdfBase64] = useState(null);

  const iniciarProcessamento = async (base64Data) => {
    setEtapa('processando');
    setErroMsg('');
    setNovoOrganograma(null);
    setDiff(null);

    try {
      setProgresso('Analisando estrutura hierárquica com IA...');

      const jsonStr = await invocarLLMComPDF(base64Data);

      setProgresso('Processando hierarquia...');
      await sleep(300);

      let novoOrg;
      try {
        novoOrg = JSON.parse(jsonStr);
      } catch {
        throw new Error('A IA não retornou um JSON válido. Tente novamente.');
      }

      if (!novoOrg || !novoOrg.nome) {
        throw new Error('Não foi possível interpretar a estrutura do PDF.');
      }

      setProgresso('Calculando diferenças...');
      await sleep(300);

      const diffCalc = calcDiff(organogramaAtual, novoOrg);
      setNovoOrganograma(novoOrg);
      setDiff(diffCalc);
      setProgresso('');
      setEtapa('preview');

    } catch (err) {
      setErroMsg(err?.message || 'Erro ao processar o PDF. Tente novamente.');
      setEtapa('idle');
    }
  };

  const processarPdfAtual = async () => {
    if (!pdfBase64) {
      toast.error('Nenhum PDF em memória. Envie um novo PDF pelo botão abaixo.');
      return;
    }
    await iniciarProcessamento(pdfBase64);
  };

  const processarNovoPdf = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setEtapa('processando');
    setProgresso('Lendo PDF...');
    try {
      // Converte para base64 para enviar à API da Anthropic
      const base64 = await fileToBase64(file);
      setPdfBase64(base64);

      // Também faz upload no Cloudinary para salvar a URL no sistema
      try {
        await uploadFile(file);
      } catch {
        // Upload para Cloudinary é opcional — não bloqueia o processamento
      }

      await iniciarProcessamento(base64);
    } catch {
      setErroMsg('Erro ao ler o PDF.');
      setEtapa('idle');
    }
  };

  const confirmar = async () => {
    setEtapa('confirmando');
    await sleep(300);
    await onConfirmar(novoOrganograma);
    fechar();
  };

  const fechar = () => {
    setEtapa('idle');
    setProgresso('');
    setNovoOrganograma(null);
    setDiff(null);
    setErroMsg('');
    onClose();
  };

  const totalMudancas = diff ? diff.adicionados.length + diff.alterados.length + diff.removidos.length : 0;

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Atualizar Organograma via PDF
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-1">

          {/* ── IDLE ── */}
          {etapa === 'idle' && (
            <div className="space-y-4">
              {erroMsg && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {erroMsg}
                </div>
              )}
              <div className="bg-muted/40 border border-border rounded-xl p-5 space-y-3">
                <p className="text-sm font-semibold">Como funciona</p>
                <ul className="text-sm text-muted-foreground space-y-1.5 list-none">
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> A IA lê o PDF e extrai toda a hierarquia automaticamente</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> Você revisa as mudanças antes de confirmar</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> Pontuações, históricos e grupos concorrentes são preservados</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> Unidades removidas são marcadas como inativas</li>
                </ul>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={processarPdfAtual} disabled={!pdfBase64}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 transition-all text-center ${pdfBase64 ? 'border-primary/40 hover:border-primary hover:bg-primary/5 cursor-pointer' : 'border-border opacity-50 cursor-not-allowed'}`}>
                  <FileText className="w-8 h-8 text-primary" />
                  <div>
                    <p className="font-semibold text-sm">Usar PDF já carregado</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{pdfBase64 ? 'PDF disponível na sessão' : 'Nenhum PDF carregado'}</p>
                  </div>
                </button>
                <label className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 p-6 transition-all cursor-pointer text-center">
                  <Upload className="w-8 h-8 text-primary" />
                  <div>
                    <p className="font-semibold text-sm">Enviar novo PDF</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Carregar arquivo do computador</p>
                  </div>
                  <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={processarNovoPdf} />
                </label>
              </div>
            </div>
          )}

          {/* ── PROCESSANDO ── */}
          {etapa === 'processando' && (
            <div className="flex flex-col items-center justify-center py-16 gap-5">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <RefreshCw className="w-6 h-6 text-primary absolute inset-0 m-auto" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm">{progresso}</p>
                <p className="text-xs text-muted-foreground mt-1">Aguarde enquanto a IA processa o organograma...</p>
              </div>
              <div className="w-64 bg-muted rounded-full h-1.5 overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '70%' }} />
              </div>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {etapa === 'preview' && novoOrganograma && diff && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-lg border p-3 text-center ${diff.adicionados.length > 0 ? 'bg-green-50 border-green-200' : 'bg-muted/30 border-border'}`}>
                  <Plus className={`w-4 h-4 mx-auto mb-1 ${diff.adicionados.length > 0 ? 'text-green-600' : 'text-muted-foreground'}`} />
                  <p className={`text-xl font-black ${diff.adicionados.length > 0 ? 'text-green-700' : 'text-muted-foreground'}`}>{diff.adicionados.length}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground">NOVAS</p>
                </div>
                <div className={`rounded-lg border p-3 text-center ${diff.alterados.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-muted/30 border-border'}`}>
                  <ArrowRight className={`w-4 h-4 mx-auto mb-1 ${diff.alterados.length > 0 ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  <p className={`text-xl font-black ${diff.alterados.length > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>{diff.alterados.length}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground">ALTERADAS</p>
                </div>
                <div className={`rounded-lg border p-3 text-center ${diff.removidos.length > 0 ? 'bg-red-50 border-red-200' : 'bg-muted/30 border-border'}`}>
                  <Minus className={`w-4 h-4 mx-auto mb-1 ${diff.removidos.length > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
                  <p className={`text-xl font-black ${diff.removidos.length > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>{diff.removidos.length}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground">REMOVIDAS</p>
                </div>
              </div>

              {totalMudancas === 0 && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  Organograma já está atualizado. Nenhuma alteração necessária.
                </div>
              )}

              {diff.adicionados.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-green-700 flex items-center gap-1"><Plus className="w-3 h-3" /> Unidades novas</p>
                  {diff.adicionados.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-green-50 border border-green-100 rounded px-2.5 py-1.5">
                      <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200">{u.tipo?.toUpperCase()}</Badge>
                      <span className="font-medium">{u.nome}</span>
                      {u.local && <span className="text-muted-foreground">· {u.local}</span>}
                    </div>
                  ))}
                </div>
              )}

              {diff.alterados.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1"><ArrowRight className="w-3 h-3" /> Unidades alteradas</p>
                  {diff.alterados.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-100 rounded px-2.5 py-1.5">
                      <span className="font-medium">{u.path.split('|').pop()}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-amber-700">local: {u.de.local || '—'} → {u.para.local || '—'}</span>
                    </div>
                  ))}
                </div>
              )}

              {diff.removidos.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-red-600 flex items-center gap-1"><Minus className="w-3 h-3" /> Unidades a remover</p>
                  {diff.removidos.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-red-50 border border-red-100 rounded px-2.5 py-1.5">
                      <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200">{u.tipo?.toUpperCase()}</Badge>
                      <span className="font-medium line-through text-muted-foreground">{u.nome}</span>
                      {u.local && <span className="text-muted-foreground">· {u.local}</span>}
                    </div>
                  ))}
                </div>
              )}

              <div className="border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-muted/40 border-b border-border flex items-center justify-between">
                  <p className="text-xs font-semibold">Nova estrutura hierárquica</p>
                  <Badge variant="outline" className="text-[10px]">Pré-visualização</Badge>
                </div>
                <div className="p-3 max-h-64 overflow-y-auto">
                  <PreviewNode node={novoOrganograma} depth={0} />
                </div>
              </div>

              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p><strong>Atenção:</strong> Esta ação atualizará o organograma. Pontuações e históricos não serão afetados.</p>
              </div>
            </div>
          )}

          {/* ── CONFIRMANDO ── */}
          {etapa === 'confirmando' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm font-semibold">Atualizando organograma...</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t border-border pt-3">
          {etapa === 'idle' && <Button variant="outline" onClick={fechar}>Fechar</Button>}
          {etapa === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setEtapa('idle')}><X className="w-4 h-4 mr-1" /> Cancelar</Button>
              {totalMudancas > 0 && (
                <Button onClick={confirmar} className="gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Confirmar Atualização
                </Button>
              )}
              {totalMudancas === 0 && <Button variant="outline" onClick={fechar}>Fechar</Button>}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
