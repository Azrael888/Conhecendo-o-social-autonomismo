// /api/gemini.js
// Vercel Serverless Function — usa Groq (gratuito, sem cota apertada)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY não configurada.' });
  }

  try {
    const { contents, systemInstruction, generationConfig } = req.body;

    if (!contents || !Array.isArray(contents)) {
      return res.status(400).json({ error: 'Formato inválido de contents.' });
    }

    // Converte formato Gemini ({role, parts:[{text}]}) para formato OpenAI ({role, content})
    const messages = [];

    if (systemInstruction) {
      messages.push({ role: 'system', content: String(systemInstruction) });
    }

    for (const msg of contents) {
      const role = msg.role === 'model' ? 'assistant' : 'user';
      const content = msg.parts?.map(p => p.text).join('') || '';
      messages.push({ role, content });
    }

    const body = {
      model: 'llama-3.3-70b-versatile', // gratuito, excelente qualidade
      messages,
      temperature: generationConfig?.temperature ?? 0.8,
      max_tokens: generationConfig?.maxOutputTokens ?? 800
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).json({ error: data.error.message });
    }

    const text = data.choices?.[0]?.message?.content || '';
    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
}
