export default async function handler(req, res) {
  const MASTER_KEY = process.env.JSONBIN_KEY;
  const BIN_ID     = process.env.JSONBIN_BIN_ID;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  if (!MASTER_KEY || !BIN_ID) {
    return res.status(500).json({ error: 'Storage não configurado. Verifique JSONBIN_KEY e JSONBIN_BIN_ID.' });
  }

  const jHeaders = {
    'Content-Type': 'application/json',
    'X-Master-Key': MASTER_KEY,
    'X-Bin-Versioning': 'false'
  };

  // ── GET ──
  if (req.method === 'GET') {
    try {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, { headers: jHeaders });
      const data = await r.json();
      const posts = data.record?.posts || [];
      return res.status(200).json({ posts: [...posts].reverse() });
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao carregar: ' + e.message });
    }
  }

  // ── POST ──
  if (req.method === 'POST') {
    const { nome, texto, cidade } = req.body || {};

    if (!texto || texto.trim().length < 20) {
      return res.status(400).json({ error: 'Escreva pelo menos 20 caracteres.' });
    }
    if (texto.trim().length > 800) {
      return res.status(400).json({ error: 'Máximo 800 caracteres.' });
    }

    // ── MODERAÇÃO COM GEMINI ──
    if (GEMINI_KEY) {
      try {
        const modPrompt = `Você é moderador do Social-Autonomista, comunidade filosófica de autoconhecimento e conexão humana.

Analise o relato e responda SOMENTE com JSON válido, sem markdown, sem explicação:
{"aprovado":true,"mensagem":""}

Se reprovar:
{"aprovado":false,"mensagem":"frase gentil em português convidando a reescrever"}

REPROVE apenas: ataques pessoais, discurso de ódio, spam, conteúdo sexual, links externos.
NÃO REPROVE: críticas, dúvidas, emoções fortes, informalidade.

Relato: ${texto.trim().substring(0, 600)}`;

        const modR = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: modPrompt }] }],
              generationConfig: { maxOutputTokens: 150, temperature: 0.1 }
            })
          }
        );

        const modData = await modR.json();
        const rawText = modData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        // Remove possíveis blocos markdown
        const clean = rawText.replace(/```json|```/gi, '').trim();
        const parsed = JSON.parse(clean);

        if (parsed.aprovado === false) {
          return res.status(200).json({
            ok: false,
            bloqueado: true,
            mensagem: parsed.mensagem || 'Este espaço é de acolhimento. Que tal reescrever com mais cuidado?'
          });
        }
      } catch {
        // Falha na moderação → deixa passar (não bloqueia por erro técnico)
      }
    }

    // ── SALVAR ──
    try {
      const getR = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, { headers: jHeaders });
      const getData = await getR.json();
      const posts = getData.record?.posts || [];

      const novo = {
        id: Date.now(),
        nome: (nome || '').trim().slice(0, 40) || 'Anônimo',
        cidade: (cidade || '').trim().slice(0, 30),
        texto: texto.trim().slice(0, 800),
        data: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      };

      posts.push(novo);

      await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: jHeaders,
        body: JSON.stringify({ posts: posts.slice(-200) })
      });

      return res.status(200).json({ ok: true, post: novo });
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao salvar: ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
