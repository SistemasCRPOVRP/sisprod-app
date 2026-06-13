// api/download-pdf.js
// Proxy autenticado para download de arquivos do Cloudinary

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME;

  if (!apiKey || !apiSecret || !cloudName) {
    return res.status(500).json({ error: 'Cloudinary não configurado' });
  }

  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ error: 'publicId é obrigatório' });
    }

    // Usa a API Admin do Cloudinary para buscar a URL real do arquivo
    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    
    const apiRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/raw/upload?public_ids=${encodeURIComponent(publicId)}`,
      { headers: { Authorization: authHeader } }
    );

    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ error: 'Erro ao buscar arquivo no Cloudinary' });
    }

    const apiData = await apiRes.json();
    const resource = apiData.resources?.[0];
    
    if (!resource?.secure_url) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    // Baixa o arquivo do Cloudinary com autenticação
    const fileRes = await fetch(resource.secure_url, {
      headers: { Authorization: authHeader }
    });

    if (!fileRes.ok) {
      return res.status(fileRes.status).json({ error: 'Erro ao baixar arquivo' });
    }

    // Repassa o arquivo para o usuário
    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
    const fileName = publicId.split('/').pop() + '.pdf';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    const buffer = await fileRes.arrayBuffer();
    res.send(Buffer.from(buffer));

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
}