/**
 * Exportação profissional para Excel (.xlsx) usando SheetJS
 * Gera planilha com cabeçalho institucional, colunas auto-dimensionadas,
 * estilos de cabeçalho, linha de totais destacada e rodapé.
 */
import * as XLSX from 'xlsx';

/**
 * @param {object} opts
 * @param {string} opts.titulo - Título do relatório
 * @param {string} opts.periodoLabel - Ex: "Abr–Jun 2026"
 * @param {string} opts.geradoPor - Nome/email do usuário
 * @param {string} opts.now - Timestamp formatado
 * @param {number} opts.totalRegistros
 * @param {number|string} opts.totalQtd
 * @param {number|string} opts.totalPontos
 * @param {string[]} opts.headers - Cabeçalhos das colunas
 * @param {(string|number)[][]} opts.rows - Linhas de dados (última pode ser totais)
 * @param {string} opts.filename - Nome do arquivo sem extensão
 * @param {boolean} [opts.hasTotalRow] - Se a última linha é de totais
 */
export function exportXlsx({ titulo, periodoLabel, geradoPor, now, totalRegistros, totalQtd, totalPontos, headers, rows, filename, hasTotalRow = true }) {
  const wb = XLSX.utils.book_new();

  // ── Dados da planilha (montamos como array de arrays) ──────────────────────
  const sheetData = [];

  // Bloco de cabeçalho institucional (linhas de metadados)
  sheetData.push(['BRIGADA MILITAR — RIO GRANDE DO SUL']);
  sheetData.push(['SISTEMA DE PRODUTIVIDADE OPERACIONAL — SISPROD BM']);
  sheetData.push([titulo]);
  sheetData.push([]); // linha em branco
  sheetData.push(['Período de Referência:', periodoLabel, '', 'Total de Registros:', totalRegistros]);
  sheetData.push(['Quantidade Total:', totalQtd,        '', 'Pontuação Total:', totalPontos]);
  sheetData.push(['Gerado em:', now,                    '', 'Responsável:', geradoPor]);
  sheetData.push([]); // linha em branco

  const dataStartRow = sheetData.length; // índice 0-based da linha de cabeçalho das colunas

  // Cabeçalho das colunas
  sheetData.push(headers);

  // Linhas de dados
  rows.forEach(row => sheetData.push(row));

  // ── Cria worksheet ─────────────────────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // ── Auto-largura das colunas ───────────────────────────────────────────────
  const colWidths = [];
  sheetData.forEach(row => {
    (row || []).forEach((cell, ci) => {
      const len = cell != null ? String(cell).length : 0;
      if (!colWidths[ci] || colWidths[ci] < len) colWidths[ci] = len;
    });
  });
  ws['!cols'] = colWidths.map(w => ({ wch: Math.min(Math.max(w + 2, 8), 60) }));

  // ── Mescla células do cabeçalho institucional (linhas 0-2) ────────────────
  const totalCols = headers.length - 1;
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols } }, // "BRIGADA MILITAR..."
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols } }, // "SISPROD BM"
    { s: { r: 2, c: 0 }, e: { r: 2, c: totalCols } }, // título
  ];

  // ── Estilos via cell metadata (SheetJS Community suporta via write options) ─
  // Aplicamos estilos manualmente nas células críticas
  const setCellStyle = (r, c, style) => {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (!ws[addr]) ws[addr] = { t: 's', v: '' };
    ws[addr].s = style;
  };

  const headerBgStyle = {
    fill: { fgColor: { rgb: '1B5E35' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border: {
      bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
      right:  { style: 'thin', color: { rgb: 'FFFFFF' } },
    },
  };

  const titleStyle = {
    font: { bold: true, sz: 13, color: { rgb: '1B5E35' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  const subtitleStyle = {
    font: { bold: true, sz: 10, color: { rgb: '1B5E35' } },
    alignment: { horizontal: 'center' },
  };

  const metaLabelStyle = {
    font: { bold: true, sz: 9, color: { rgb: '1B5E35' } },
  };

  const metaValueStyle = {
    font: { sz: 9 },
    alignment: { horizontal: 'left' },
  };

  const colHeaderStyle = {
    fill: { fgColor: { rgb: '1B5E35' } },
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 9 },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border: {
      top:    { style: 'thin', color: { rgb: 'FFFFFF' } },
      bottom: { style: 'medium', color: { rgb: 'FFFFFF' } },
      left:   { style: 'thin', color: { rgb: 'FFFFFF' } },
      right:  { style: 'thin', color: { rgb: 'FFFFFF' } },
    },
  };

  const totalRowStyle = {
    fill: { fgColor: { rgb: 'C8E6C9' } },
    font: { bold: true, sz: 9, color: { rgb: '1B5E35' } },
    border: {
      top:    { style: 'medium', color: { rgb: '1B5E35' } },
      bottom: { style: 'thin',   color: { rgb: '1B5E35' } },
    },
  };

  const dataStyleEven = { font: { sz: 9 }, alignment: { vertical: 'center' } };
  const dataStyleOdd  = { fill: { fgColor: { rgb: 'F0F7F0' } }, font: { sz: 9 }, alignment: { vertical: 'center' } };

  // Aplica estilos
  // Linha 0: título principal
  setCellStyle(0, 0, titleStyle);
  // Linha 1: subtítulo
  setCellStyle(1, 0, subtitleStyle);
  // Linha 2: nome do relatório
  setCellStyle(2, 0, { font: { bold: true, sz: 11, color: { rgb: '333333' } }, alignment: { horizontal: 'center' } });

  // Metadados (linhas 4-6)
  [4, 5, 6].forEach(r => {
    setCellStyle(r, 0, metaLabelStyle);
    setCellStyle(r, 1, metaValueStyle);
    setCellStyle(r, 3, metaLabelStyle);
    setCellStyle(r, 4, metaValueStyle);
  });

  // Cabeçalho das colunas
  headers.forEach((_, ci) => setCellStyle(dataStartRow, ci, colHeaderStyle));

  // Linhas de dados
  const dataRows = hasTotalRow ? rows.length - 1 : rows.length;
  for (let ri = 0; ri < dataRows; ri++) {
    const style = ri % 2 === 0 ? dataStyleEven : dataStyleOdd;
    headers.forEach((_, ci) => setCellStyle(dataStartRow + 1 + ri, ci, style));
  }

  // Linha de totais
  if (hasTotalRow && rows.length > 0) {
    const totalRowIdx = dataStartRow + rows.length; // última linha
    headers.forEach((_, ci) => setCellStyle(totalRowIdx, ci, totalRowStyle));
  }

  // ── Altura das linhas de cabeçalho ─────────────────────────────────────────
  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 22 };
  ws['!rows'][1] = { hpt: 16 };
  ws['!rows'][2] = { hpt: 18 };
  ws['!rows'][dataStartRow] = { hpt: 20 };

  // ── Adiciona sheet e salva ─────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');

  // Sheet de metadados separada
  const wsMeta = XLSX.utils.aoa_to_sheet([
    ['Campo', 'Valor'],
    ['Sistema', 'SISPROD BM — Brigada Militar / RS'],
    ['Relatório', titulo],
    ['Período', periodoLabel],
    ['Total de Registros', totalRegistros],
    ['Quantidade Total', totalQtd],
    ['Pontuação Total', totalPontos],
    ['Gerado em', now],
    ['Responsável', geradoPor],
  ]);
  wsMeta['!cols'] = [{ wch: 22 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadados');

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
