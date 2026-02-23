export default async function handler(req, res) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const jsonbinKey = process.env.JSONBIN_KEY;
  const binId = process.env.JSONBIN_BIN_ID;

  // Testa Gemini
  let geminiStatus = 'não configurado';
  if (geminiKey) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Responda apenas: ok' }] }],
            generationConfig: { maxOutputTokens: 10 }
          })
        }
      );
      const d = await r.json();
      geminiStatus = r.ok ? '✅ funcionando' : '❌ erro: ' + (d.error?.message || 'desconhecido');
    } catch (e) {
      geminiStatus = '❌ exceção: ' + e.message;
    }
  }

  // Testa JSONBin
  let jsonbinStatus = 'não configurado';
  if (jsonbinKey && binId) {
    try {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
        headers: { 'X-Master-Key': jsonbinKey }
      });
      jsonbinStatus = r.ok ? '✅ funcionando' : '❌ erro HTTP ' + r.status;
    } catch (e) {
      jsonbinStatus = '❌ exceção: ' + e.message;
    }
  }

  return res.status(200).json({
    gemini: geminiStatus,
    jsonbin: jsonbinStatus
  });
  }
    
