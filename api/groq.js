// api/groq.js — Vercel Serverless Function
// Env var necessária: GROQ_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });
  }

  try {
    const { prompt, system, max_tokens = 512, temperature = 0.8 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Campo "prompt" obrigatório' });
    }

    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Groq error:', err);
      return res.status(502).json({ error: 'Erro na API Groq' });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    return res.status(200).json({ text });

  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: 'Erro interno' });
  }
      }
  
