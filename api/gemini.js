// /api/gemini.js
// Vercel Serverless Function

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY não configurada.' });
  }

  try {
    const { contents, systemInstruction, generationConfig } = req.body;

    if (!contents || !Array.isArray(contents)) {
      return res.status(400).json({ error: 'Formato inválido de contents.' });
    }

    // Descobre qual modelo está disponível nessa chave
    const model = await getAvailableModel(apiKey);
    if (!model) {
      return res.status(500).json({ error: 'Nenhum modelo Gemini disponível para esta chave.' });
    }

    // Injeta system prompt como primeiras mensagens — sem depender de campos da API
    let fullContents = contents;
    if (systemInstruction) {
      fullContents = [
        { role: 'user',  parts: [{ text: String(systemInstruction) }] },
        { role: 'model', parts: [{ text: 'Entendido. Estou pronto.' }] },
        ...contents
      ];
    }

    const body = {
      contents: fullContents,
      generationConfig: generationConfig || {
        temperature: 0.8,
        maxOutputTokens: 800
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map(p => p.text)
        ?.join('') || '';

    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
}

// Consulta a API e retorna o primeiro modelo que suporta generateContent
async function getAvailableModel(apiKey) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await res.json();

    if (!data.models) return null;

    // Preferência: modelos flash/pro que suportam generateContent
    const preferred = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro',
      'gemini-1.0-pro'
    ];

    // Pega todos os que suportam generateContent
    const available = data.models
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));

    // Tenta os preferidos primeiro, na ordem
    for (const p of preferred) {
      if (available.includes(p)) return p;
    }

    // Se nenhum preferido, usa o primeiro disponível
    return available[0] || null;

  } catch (e) {
    return null;
  }
}
