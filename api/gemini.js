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
    return res.status(500).json({
      error: 'GEMINI_API_KEY não configurada.'
    });
  }

  try {
    const { contents, systemInstruction, generationConfig } = req.body;

    if (!contents || !Array.isArray(contents)) {
      return res.status(400).json({
        error: 'Formato inválido de contents.'
      });
    }

    const body = {
      contents,
      generationConfig: generationConfig || {
        temperature: 0.8,
        maxOutputTokens: 800
      }
    };

    if (systemInstruction) {
      body.system_instruction = {
        parts: [{ text: String(systemInstruction) }]
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
    return res.status(500).json({
      error: 'Erro interno: ' + err.message
    });
  }
}
