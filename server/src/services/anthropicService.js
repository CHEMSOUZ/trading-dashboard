const https = require('https');
const { ANTHROPIC_API_KEY } = require('../config/env');

const MODEL = 'claude-sonnet-4-6';

function chat(messages, systemPrompt, maxTokens = 1024) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: (messages || []).map(m => ({ role: m.role, content: m.content })),
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      port: 443,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve({
            text: parsed.content?.[0]?.text ?? '',
            usage: {
              inputTokens: parsed.usage?.input_tokens ?? 0,
              outputTokens: parsed.usage?.output_tokens ?? 0,
            },
          });
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { chat };
