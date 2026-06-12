// api/download-pdf.js
// Gera URL assinada temporária para download de PDFs do Cloudinary

import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME;

  if (!apiKey || !apiSecret || !cloudName) {
    return res.status(500).json({ error: 'Cloudinary não configurado no servidor' });
  }

  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ error: 'publicId é obrigatório' });
    }

    // Gera URL assinada válida por 1 hora (3600 segundos)
    const timestamp = Math.round(Date.now() / 1000) + 3600;
    const toSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(toSign).digest('hex');

    const signedUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/`
      + `?public_id=${encodeURIComponent(publicId)}`
      + `&timestamp=${timestamp}`
      + `&api_key=${apiKey}`
      + `&signature=${signature}`;

    return res.status(200).json({ url: signedUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
}