export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const MASTER_KEY = process.env.JSONBIN_KEY;
  const BIN_ID     = process.env.JSONBIN_BIN_ID;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  if (!MASTER_KEY || !BIN_ID) {
    return res.status(500).json({ error: 'Storage não configurado.' });
  }

  const jHeaders = {
    'Content-Type': 'application/json',
    'X-Master-Key': MASTER_KEY,
    'X-Bin-Versioning': 'false'
  };

  // ── GET: listar relatos ──
  if (req.method === 'GET') {
    try {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, { headers: jHeaders });
      if (!r.ok) throw new Error('JSONBin retornou ' + r.status);
      const data = await r.json();
      const posts = Array.isArray(data.record?.posts) ? data.record.posts : [];
      return res.status(200).json({ posts: [...posts].reverse() });
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao carregar relatos: ' + e.message });
    }
  }

  // ── POST: moderar e salvar ──
  if (req.method === 'POST') {
    // Protege contra body vazio
    const body = req.body || {};
    const texto  = (body.texto  || '').trim();
    const nome   = (body.nome   || '').trim().slice(0, 40) || 'Anônimo';
    const cidade = (body.cidade || '').trim().slice(0, 30);

    if (texto.length < 20) {
      return res.status(400).json({ error: 'Escreva pelo menos 20 caracteres.' });
    }
    if (texto.length > 800) {
      return res.status(400).json({ error: 'Máximo 800 caracteres.' });
    }

    // ── MODERAÇÃO ──
    if (GEMINI_KEY) {
      try {
        const modPrompt = `Você é moderador do Social-Autonomista, comunidade filosófica de autoconhecimento.
Analise o relato abaixo e responda SOMENTE com JSON válido, sem markdown:
{"aprovado":true,"mensagem":""}
ou se reprovar:
{"aprovado":false,"mensagem":"mensagem gentil em português convidando a reescrever"}
REPROVE apenas: ataques pessoais, ódio, spam, conteúdo sexual, links.
NÃO REPROVE: críticas, dúvidas, emoções fortes, informalidade.
Relato: ${texto.substring(0, 600)}`;

        const modR = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: modPrompt }] }],
              generationConfig: { maxOutputTokens: 150, temperature: 0.1 }
            })
          }
        );

        if (modR.ok) {
          const modData = await modR.json();
          const rawText = modData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          // Remove markdown se vier
          const clean = rawText.replace(/```json|```/gi, '').trim();
          // Extrai só o JSON (entre { e })
          const match = clean.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.aprovado === false) {
              return res.status(200).json({
                ok: false,
                bloqueado: true,
                mensagem: parsed.mensagem || 'Este espaço é de acolhimento. Que tal reescrever com mais cuidado?'
              });
            }
          }
        }
      } catch {
        // Falha técnica na moderação → deixa passar
      }
    }

    // ── SALVAR ──
    try {
      const getR = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, { headers: jHeaders });
      if (!getR.ok) throw new Error('Erro ao ler storage');
      const getData = await getR.json();
      const posts = Array.isArray(getData.record?.posts) ? getData.record.posts : [];

      const novo = {
        id: Date.now(),
        nome,
        cidade,
        texto,
        data: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      };

      posts.push(novo);

      const putR = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: jHeaders,
        body: JSON.stringify({ posts: posts.slice(-200) })
      });

      if (!putR.ok) throw new Error('Erro ao salvar storage');

      return res.status(200).json({ ok: true, post: novo });
    } catch (e) {
      return res.status(500).json({ error: 'Erro ao salvar: ' + e.message });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
      }
      
