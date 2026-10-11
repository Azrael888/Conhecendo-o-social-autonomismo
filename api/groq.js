// api/groq.js — Vercel Serverless Function
//
// Variáveis de ambiente no Vercel:
//   GROQ_API_KEY         (obrigatória)
//   GROQ_MODEL           (opcional) modelo principal. Padrão: openai/gpt-oss-120b
//   GROQ_FALLBACK_MODEL  (opcional) modelo reserva, usado se o principal for desligado.
//                        Padrão: qwen/qwen3.6-27b
//
// Quando o Groq desligar outro modelo, basta mudar GROQ_MODEL no Vercel e fazer um novo deploy.
// Lista de modelos e datas de desligamento: https://console.groq.com/docs/deprecations

const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_FALLBACK = 'qwen/qwen3.6-27b';

// Modelos de raciocínio "pensam" antes de responder e esses tokens contam no limite.
// Esta folga evita respostas cortadas ou vazias quando o site pede poucos tokens.
const REASONING_BUFFER = 1024;

function clamp(n, min, max, def) {
  const v = Number(n);
  if (!Number.isFinite(v)) return def;
  return Math.min(max, Math.max(min, v));
}

function buildPayload(model, messages, maxTokens, temperature) {
  const payload = {
    model,
    messages,
    max_completion_tokens: maxTokens + REASONING_BUFFER,
    temperature,
  };
  // raciocínio curto: respostas mais rápidas e mais baratas
  if (/gpt-oss/i.test(model)) payload.reasoning_effort = 'low';
  return payload;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY não configurada' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { prompt, system } = body;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Campo "prompt" obrigatório' });
  }

  // limites para o endpoint não virar um canal aberto para gastar a cota do Groq
  const maxTokens = clamp(body.max_tokens, 1, 1000, 512);
  const temperature = clamp(body.temperature, 0, 1.5, 0.8);

  const messages = [];
  if (typeof system === 'string' && system.trim()) {
    messages.push({ role: 'system', content: system.slice(0, 2000) });
  }
  messages.push({ role: 'user', content: prompt.slice(0, 4000) });

  const modelos = [
    process.env.GROQ_MODEL || DEFAULT_MODEL,
    process.env.GROQ_FALLBACK_MODEL || DEFAULT_FALLBACK,
  ].filter((m, i, arr) => m && arr.indexOf(m) === i);

  try {
    for (let i = 0; i < modelos.length; i++) {
      const model = modelos[i];

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildPayload(model, messages, maxTokens, temperature)),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error(`Groq error (${model}) ${response.status}:`, err);

        // modelo desligado ou inexistente: tenta o reserva
        const modeloIndisponivel =
          (response.status === 400 || response.status === 404) &&
          /model_decommissioned|model_not_found|decommissioned|does not exist/i.test(err);
        if (modeloIndisponivel && i < modelos.length - 1) continue;

        return res.status(502).json({ error: 'Erro na API Groq' });
      }

      const data = await response.json();
      const text = (data.choices?.[0]?.message?.content || '').trim();

      if (!text) {
        console.error(`Groq devolveu resposta vazia (${model}):`, data.choices?.[0]?.finish_reason);
        return res.status(502).json({ error: 'Resposta vazia da API Groq' });
      }

      return res.status(200).json({ text });
    }

    return res.status(502).json({ error: 'Erro na API Groq' });

  } catch (e) {
    console.error('Handler error:', e);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
