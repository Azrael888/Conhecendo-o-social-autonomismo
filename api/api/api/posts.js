export default async function handler(req, res) {
  const MASTER_KEY = process.env.JSONBIN_KEY;
  const BIN_ID     = process.env.JSONBIN_BIN_ID;
  const API_KEY    = process.env.GEMINI_API_KEY;

  if (!MASTER_KEY || !BIN_ID) {
    return res.status(500).json({ error: 'Storage não configurado' });
  }

  const jsonbinHeaders = {
    'Content-Type': 'application/json',
    'X-Master-Key': MASTER_KEY,
    'X-Bin-Versioning': 'false'
  };

  // ── GET: listar relatos ──
  if (req.method === 'GET') {
    try {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: jsonbinHeaders
      });
      const data = await r.json();
      const posts = data.record?.posts || [];
      return res.status(200).json({ posts: posts.reverse() });
    } catch {
      return res.status(500).json({ error: 'Erro ao carregar relatos' });
    }
  }

  // ── POST: moderar e salvar relato ──
  if (req.method === 'POST') {
    const { nome, texto, cidade } = req.body;

    if (!texto || texto.trim().length < 20) {
      return res.status(400).json({ error: 'Escreva pelo menos 20 caracteres.' });
    }
    if (texto.trim().length > 800) {
      return res.status(400).json({ error: 'Máximo 800 caracteres.' });
    }

    // ── MODERAÇÃO COM GEMINI ──
    if (API_KEY) {
      try {
        const modPrompt = `Você é um moderador gentil de uma comunidade filosófica chamada Social-Autonomista — um movimento de autoconhecimento, círculos socráticos e conexão humana.

Analise o relato abaixo e responda EXATAMENTE em JSON válido, sem mais nada, sem markdown:
{"aprovado": true, "mensagem": ""}

ou se reprovado:
{"aprovado": false, "mensagem": "mensagem gentil e orientadora em 1-2 frases em português, sem julgamento, convidando a reescrever de forma construtiva"}

Reprove APENAS se contiver: ataques pessoais diretos, discurso de ódio, spam, conteúdo sexual explícito ou links.
NÃO reprove: críticas ao movimento, dúvidas, emoções fortes, linguagem informal, textos curtos mas sinceros.

Relato: "${texto.trim().replace(/"/g, "'")}"`;

        const modResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: modPrompt }] }],
              generationConfig: { maxOutputTokens: 200, temperature: 0.1 }
            })
          }
        );

        const modData = await modResp.json();
        const rawText = modData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const clean = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);

        if (!parsed.aprovado) {
          return res.status(200).json({
            ok: false,
            bloqueado: true,
            mensagem: parsed.mensagem || 'Este espaço é de acolhimento. Que tal reescrever com um pouco mais de cuidado?'
          });
        }
      } catch {
        // Se moderação falhar tecnicamente, deixa passar
      }
    }

    // ── SALVAR ──
    try {
      const getR = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: jsonbinHeaders
      });
      const getData = await getR.json();
      const posts = getData.record?.posts || [];

      const novoPost = {
        id: Date.now(),
        nome: nome?.trim().slice(0, 40) || 'Anônimo',
        cidade: cidade?.trim().slice(0, 30) || '',
        texto: texto.trim().slice(0, 800),
        data: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      };

      posts.push(novoPost);

      await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: jsonbinHeaders,
        body: JSON.stringify({ posts: posts.slice(-200) })
      });

      return res.status(200).json({ ok: true, post: novoPost });
    } catch {
      return res.status(500).json({ error: 'Erro ao salvar relato' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
}
