export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ content: [{ type: 'text', text: 'Método não permitido.' }] });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({
      content: [{ type: 'text', text: 'IA não configurada. Verifique GEMINI_API_KEY no Vercel.' }]
    });
  }

  // Protege contra body vazio
  if (!req.body || !req.body.messages) {
    return res.status(200).json({
      content: [{ type: 'text', text: 'Requisição inválida.' }]
    });
  }

  const { messages, max_tokens } = req.body;

  // Monta prompt unindo todas as mensagens
  const prompt = messages
    .map(m => (typeof m.content === 'string' ? m.content : ''))
    .filter(Boolean)
    .join('\n');

  if (!prompt) {
    return res.status(200).json({
      content: [{ type: 'text', text: 'Mensagem vazia.' }]
    });
  }

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: max_tokens || 500,
            temperature: 0.85
          }
        })
      }
    );

    const data = await geminiRes.json();

    // Erro da API
    if (data.error) {
      return res.status(200).json({
        content: [{ type: 'text', text: 'Serviço temporariamente indisponível. Tente novamente.' }]
      });
    }

    // Resposta bloqueada por segurança
    const candidate = data.candidates?.[0];
    if (!candidate || candidate.finishReason === 'SAFETY') {
      return res.status(200).json({
        content: [{ type: 'text', text: 'O oráculo escolheu o silêncio desta vez. Tente reformular.' }]
      });
    }

    const text = candidate.content?.parts?.[0]?.text || '';

    if (!text) {
      return res.status(200).json({
        content: [{ type: 'text', text: 'Resposta vazia. Tente novamente.' }]
      });
    }

    return res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (err) {
    return res.status(200).json({
      content: [{ type: 'text', text: 'Erro de conexão. Verifique sua internet e tente novamente.' }]
    });
  }
}
  
