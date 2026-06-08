// Estrutura hierárquica completa do CRPM/VRP - Março/2026
// Baseada no organograma oficial

export const CRPM = 'CRPM/VRP';

export const BPMs = [
  { value: '2º BPM', label: '2º BPM - Rio Pardo' },
  { value: '23º BPM', label: '23º BPM - Santa Cruz do Sul' },
];

// Estrutura: BPM → Companhia → Pelotão → GPM → Município
export const ORG_STRUCTURE = {
  '2º BPM': {
    cias: {
      '1ª Cia': {
        municipio: 'Rio Pardo',
        pelotoes: {
          '1º Pel': {
            municipio: 'Rio Pardo',
            gpms: [
              { nome: '1º GPM', municipio: 'Rio Pardo' },
              { nome: '2º GPM', municipio: 'Rio Pardo' },
            ],
          },
          '2º Pel': {
            municipio: 'Rio Pardo',
            gpms: [
              { nome: '1º GPM', municipio: 'Rio Pardo' },
              { nome: '2º GPM', municipio: 'Rio Pardo' },
            ],
          },
          '3º Pel (FT)': {
            municipio: 'Rio Pardo',
            gpms: [
              { nome: '1º GPM', municipio: 'Rio Pardo' },
              { nome: '2º GPM', municipio: 'Rio Pardo' },
              { nome: '3º GPM', municipio: 'Rio Pardo' },
            ],
          },
          '4º Pel': {
            municipio: 'Pantano Grande',
            gpms: [
              { nome: '1º GPM', municipio: 'Pantano Grande' },
              { nome: '2º GPM', municipio: 'Pantano Grande' },
              { nome: '3º GPM', municipio: 'Pantano Grande' },
            ],
          },
        },
      },
      '2ª Cia': {
        municipio: 'Encruzilhada do Sul',
        pelotoes: {
          '1º Pel': {
            municipio: 'Encruzilhada do Sul',
            gpms: [
              { nome: '1º GPM', municipio: 'Encruzilhada do Sul' },
              { nome: '2º GPM', municipio: 'Encruzilhada do Sul' },
            ],
          },
          '2º Pel': {
            municipio: 'Encruzilhada do Sul',
            gpms: [
              { nome: '1º GPM', municipio: 'Encruzilhada do Sul' },
              { nome: '2º GPM', municipio: 'Encruzilhada do Sul' },
            ],
          },
        },
      },
    },
  },
  '23º BPM': {
    cias: {
      '1ª Cia': {
        municipio: 'Santa Cruz do Sul',
        pelotoes: {
          '1º Pel': {
            municipio: 'Santa Cruz do Sul',
            gpms: [
              { nome: '1º GPM', municipio: 'Santa Cruz do Sul' },
              { nome: '2º GPM', municipio: 'Santa Cruz do Sul' },
              { nome: '3º GPM', municipio: 'Santa Cruz do Sul' },
              { nome: '4º GPM', municipio: 'Santa Cruz do Sul' },
              { nome: '5º GPM', municipio: 'Santa Cruz do Sul' },
            ],
          },
          '2º Pel': {
            municipio: 'Santa Cruz do Sul',
            gpms: [
              { nome: '1º GPM', municipio: 'Santa Cruz do Sul' },
              { nome: '2º GPM', municipio: 'Santa Cruz do Sul' },
              { nome: '3º GPM', municipio: 'Santa Cruz do Sul' },
              { nome: '4º GPM', municipio: 'Santa Cruz do Sul' },
            ],
          },
          '3º Pel': {
            municipio: 'Santa Cruz do Sul',
            gpms: [
              { nome: '1º GPM', municipio: 'Santa Cruz do Sul' },
              { nome: '2º GPM', municipio: 'Santa Cruz do Sul' },
              { nome: '3º GPM', municipio: 'Santa Cruz do Sul' },
              { nome: '4º GPM', municipio: 'Santa Cruz do Sul' },
            ],
          },
          '4º Pel (FT)': {
            municipio: 'Santa Cruz do Sul',
            gpms: [
              { nome: '1º GPM', municipio: 'Santa Cruz do Sul' },
              { nome: '2º GPM', municipio: 'Santa Cruz do Sul' },
              { nome: '3º GPM', municipio: 'Santa Cruz do Sul' },
              { nome: '4º GPM', municipio: 'Santa Cruz do Sul' },
            ],
          },
          '5º Pel': {
            municipio: 'Vera Cruz',
            gpms: [
              { nome: '1º GPM', municipio: 'Vera Cruz' },
              { nome: '2º GPM', municipio: 'Vera Cruz' },
              { nome: '3º GPM', municipio: 'Vera Cruz' },
            ],
          },
          '6º Pel': {
            municipio: 'Sinimbu',
            gpms: [
              { nome: '1º GPM', municipio: 'Sinimbu' },
              { nome: '2º GPM', municipio: 'Sinimbu' },
            ],
          },
        },
      },
      '2ª Cia': {
        municipio: 'Sobradinho',
        pelotoes: {
          '1º Pel': {
            municipio: 'Sobradinho',
            gpms: [
              { nome: '1º GPM', municipio: 'Sobradinho' },
              { nome: '2º GPM', municipio: 'Sobradinho' },
              { nome: '3º GPM', municipio: 'Sobradinho' },
              { nome: '4º GPM', municipio: 'Ibarama' },
              { nome: '5º GPM', municipio: 'Lagoa Bonita do Sul' },
              { nome: '6º GPM', municipio: 'Passa Sete' },
              { nome: '7º GPM', municipio: 'Lagoão' },
            ],
          },
          '2º Pel': {
            municipio: 'Arroio do Tigre',
            gpms: [
              { nome: '1º GPM', municipio: 'Arroio do Tigre' },
              { nome: '2º GPM', municipio: 'Arroio do Tigre' },
              { nome: '3º GPM', municipio: 'Tunas' },
              { nome: '4º GPM', municipio: 'Estrela Velha' },
              { nome: '5º GPM', municipio: 'Segredo' },
            ],
          },
        },
      },
      '3ª Cia': {
        municipio: 'Venâncio Aires',
        pelotoes: {
          '1º Pel': {
            municipio: 'Venâncio Aires',
            gpms: [
              { nome: '1º GPM', municipio: 'Venâncio Aires' },
              { nome: '2º GPM', municipio: 'Venâncio Aires' },
              { nome: '3º GPM', municipio: 'Venâncio Aires' },
              { nome: '4º GPM', municipio: 'Venâncio Aires' },
              { nome: '5º GPM', municipio: 'Mato Leitão' },
              { nome: '6º GPM', municipio: 'Gramado Xavier' },
              { nome: '7º GPM', municipio: 'Boqueirão do Leão' },
            ],
          },
          '2º Pel': {
            municipio: 'Venâncio Aires',
            gpms: [
              { nome: '1º GPM', municipio: 'Venâncio Aires' },
              { nome: '2º GPM', municipio: 'Venâncio Aires' },
              { nome: '3º GPM', municipio: 'Venâncio Aires' },
              { nome: '4º GPM', municipio: 'Venâncio Aires' },
              { nome: '5º GPM', municipio: 'Vale Verde' },
              { nome: '6º GPM', municipio: 'Passo do Sobrado' },
            ],
          },
        },
      },
      '4ª Cia': {
        municipio: 'Candelária',
        pelotoes: {
          '1º Pel': {
            municipio: 'Candelária',
            gpms: [
              { nome: '1º GPM', municipio: 'Candelária' },
              { nome: '2º GPM', municipio: 'Candelária' },
              { nome: '3º GPM', municipio: 'Candelária' },
              { nome: '4º GPM', municipio: 'Candelária' },
            ],
          },
          '2º Pel': {
            municipio: 'Candelária',
            gpms: [
              { nome: '1º GPM', municipio: 'Candelária' },
              { nome: '2º GPM', municipio: 'Candelária' },
              { nome: '3º GPM', municipio: 'Candelária' },
            ],
          },
          '3º Pel': {
            municipio: 'Vale do Sol',
            gpms: [
              { nome: '1º GPM', municipio: 'Vale do Sol' },
              { nome: '2º GPM', municipio: 'Herveiras' },
            ],
          },
        },
      },
    },
  },
};

/**
 * MAPA DE CONSOLIDAÇÃO TERRITORIAL (Regras I–V do normativo)
 * Para cada município, define a OPM de maior nível que consolida toda a produção.
 * Chave: município · Valor: { bpm, companhia?, pelotao? }
 * – Se houver Cia: toda produção do município vai para a Cia (Pels + GPMs subordinados)
 * – Se houver Pel sem Cia: toda produção do município vai para o Pel
 * – Se houver apenas GPM: produção fica no GPM (sem consolidação extra)
 */
export const CONSOLIDACAO_MUNICIPAL = {
  // ── 2º BPM ──
  'Rio Pardo':            { bpm: '2º BPM', companhia: '1ª Cia' },
  'Encruzilhada do Sul':  { bpm: '2º BPM', companhia: '2ª Cia' },
  'Pantano Grande':       { bpm: '2º BPM', companhia: '1ª Cia', pelotao: '4º Pel' }, // Pel é a maior OPM

  // ── 23º BPM ──
  'Santa Cruz do Sul':    { bpm: '23º BPM', companhia: '1ª Cia' },
  'Vera Cruz':            { bpm: '23º BPM', companhia: '1ª Cia', pelotao: '5º Pel' },
  'Sinimbu':              { bpm: '23º BPM', companhia: '1ª Cia', pelotao: '6º Pel' },
  'Sobradinho':           { bpm: '23º BPM', companhia: '2ª Cia' },
  'Arroio do Tigre':      { bpm: '23º BPM', companhia: '2ª Cia', pelotao: '2º Pel' },
  // GPMs isolados (maior OPM = GPM, sem consolidação ascendente)
  'Tunas':                null, // GPM direto
  'Ibarama':              null,
  'Estrela Velha':        null,
  'Lagoa Bonita do Sul':  null,
  'Segredo':              null,
  'Passa Sete':           null,
  'Lagoão':               null,
  'Venâncio Aires':       { bpm: '23º BPM', companhia: '3ª Cia' },
  'Mato Leitão':          null,
  'Boqueirão do Leão':    null,
  'Gramado Xavier':       null,
  'Vale Verde':           null,
  'Passo do Sobrado':     null,
  'Candelária':           { bpm: '23º BPM', companhia: '4ª Cia' },
  'Vale do Sol':          { bpm: '23º BPM', companhia: '4ª Cia', pelotao: '3º Pel' },
  'Herveiras':            null,
};

// Todos os municípios únicos
export const MUNICIPIOS = [
  'Arroio do Tigre',
  'Boqueirão do Leão',
  'Candelária',
  'Encruzilhada do Sul',
  'Estrela Velha',
  'Gramado Xavier',
  'Herveiras',
  'Ibarama',
  'Lagoa Bonita do Sul',
  'Lagoão',
  'Mato Leitão',
  'Pantano Grande',
  'Passa Sete',
  'Passo do Sobrado',
  'Rio Pardo',
  'Santa Cruz do Sul',
  'Segredo',
  'Sinimbu',
  'Sobradinho',
  'Tunas',
  'Vale do Sol',
  'Vale Verde',
  'Venâncio Aires',
  'Vera Cruz',
];

// Retorna todas as Cias de um BPM
export function getCias(bpm) {
  if (!bpm || !ORG_STRUCTURE[bpm]) return [];
  return Object.keys(ORG_STRUCTURE[bpm].cias);
}

// Retorna todos os Pelotões de uma Cia
export function getPelotoes(bpm, cia) {
  if (!bpm || !cia) return [];
  const ciaData = ORG_STRUCTURE[bpm]?.cias?.[cia];
  if (!ciaData) return [];
  return Object.keys(ciaData.pelotoes);
}

// Retorna os GPMs de um Pelotão
export function getGPMs(bpm, cia, pel) {
  if (!bpm || !cia || !pel) return [];
  return ORG_STRUCTURE[bpm]?.cias?.[cia]?.pelotoes?.[pel]?.gpms || [];
}

// Município automático do Pelotão
export function getMunicipioPel(bpm, cia, pel) {
  if (!bpm || !cia || !pel) return '';
  return ORG_STRUCTURE[bpm]?.cias?.[cia]?.pelotoes?.[pel]?.municipio || '';
}

// Município automático da Cia
export function getMunicipioCia(bpm, cia) {
  if (!bpm || !cia) return '';
  return ORG_STRUCTURE[bpm]?.cias?.[cia]?.municipio || '';
}