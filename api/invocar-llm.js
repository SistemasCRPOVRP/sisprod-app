// api/invocar-llm.js
// Vercel Serverless Function — chama a API da Anthropic com a chave segura no servidor

export default async function handler(req, res) {
  // Apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' });
  }

  try {
    const { base64Data } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'base64Data é obrigatório' });
    }

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
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const texto = data.content?.find(c => c.type === 'text')?.text || '';
    const jsonStr = texto.replace(/```json|```/g, '').trim();

    return res.status(200).json({ result: jsonStr });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
}