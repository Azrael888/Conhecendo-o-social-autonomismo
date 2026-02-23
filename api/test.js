export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const geminiKey  = process.env.GEMINI_API_KEY;
  const jsonbinKey = process.env.JSONBIN_KEY;
  const binId      = process.env.JSONBIN_BIN_ID;

  const result = {
    gemini:  geminiKey  ? 'chave encontrada, testando...' : '❌ GEMINI_API_KEY não configurado',
    jsonbin: (jsonbinKey && binId) ? 'chaves encontradas, testando...' : '❌ JSONBIN_KEY ou JSONBIN_BIN_ID não configurado'
  };

  // Testa Gemini
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Responda apenas com a palavra: ok' }] }],
            generationConfig: { maxOutputTokens: 5 }
          })
        }
      );
      const d = await r.json();
      if (d.error) {
        result.gemini = '❌ Erro: ' + d.error.message;
      } else if (d.candidates?.[0]?.content?.parts?.[0]?.text) {
        result.gemini = '✅ funcionando';
      } else {
        result.gemini = '⚠️ Resposta inesperada: ' + JSON.stringify(d).slice(0, 100);
      }
    } catch (e) {
      result.gemini = '❌ Exceção: ' + e.message;
    }
  }

  // Testa JSONBin
  if (jsonbinKey && binId) {
    try {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: { 'X-Master-Key': jsonbinKey, 'X-Bin-Versioning': 'false' }
      });
      const d = await r.json();
      if (!r.ok) {
        result.jsonbin = '❌ Erro HTTP ' + r.status + ': ' + (d.message || '');
      } else if (d.record !== undefined) {
        const total = Array.isArray(d.record?.posts) ? d.record.posts.length : 0;
        result.jsonbin = `✅ funcionando (${total} relato${total !== 1 ? 's' : ''} salvos)`;
      } else {
        result.jsonbin = '⚠️ Bin vazio ou formato inesperado';
      }
    } catch (e) {
      result.jsonbin = '❌ Exceção: ' + e.message;
    }
  }

  return res.status(200).json(result);
                 }
          
