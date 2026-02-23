export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      content: [{ type: 'text', text: 'Chave GEMINI_API_KEY não configurada no Vercel.' }]
    });
  }

  try {
    const { messages, max_tokens } = req.body;

    // Junta todas as mensagens em um único prompt
    const prompt = messages
      ?.map(m => (typeof m.content === 'string' ? m.content : ''))
      .join('\n') || '';

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: max_tokens || 500,
            temperature: 0.85
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' }
          ]
        })
      }
    );

    const geminiData = await geminiRes.json();

    // Verifica erro da API Gemini
    if (!geminiRes.ok || geminiData.error) {
      const errMsg = geminiData.error?.message || 'Erro ao contatar o Gemini';
      return res.status(200).json({
        content: [{ type: 'text', text: errMsg }]
      });
    }

    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!text) {
      return res.status(200).json({
        content: [{ type: 'text', text: 'Resposta vazia. Tente novamente.' }]
      });
    }

    // Retorna no formato que o frontend espera (igual Anthropic)
    return res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (err) {
    return res.status(200).json({
      content: [{ type: 'text', text: 'Erro interno: ' + (err.message || 'desconhecido') }]
    });
  }
                 }
              
