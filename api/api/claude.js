export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key não configurada' });
  }

  // Extrai mensagens do formato Anthropic que o frontend envia
  const { messages, max_tokens, system } = req.body;
  const lastMessage = messages?.[messages.length - 1]?.content || '';

  // Monta o prompt completo com system prompt se existir
  const fullPrompt = system ? `${system}\n\n${lastMessage}` : lastMessage;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            maxOutputTokens: max_tokens || 500,
            temperature: 0.8
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Erro Gemini' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Retorna no formato Anthropic que o frontend espera
    return res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (error) {
    return res.status(500).json({ error: 'Erro ao contatar a IA' });
  }
}
