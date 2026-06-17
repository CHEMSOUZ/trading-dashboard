const anthropicService = require('../services/anthropicService');
const usageService = require('../services/usageService');

async function chat(req, res, next) {
  try {
    const { messages, systemPrompt, maxTokens } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Le champ "messages" est requis.' });
    }

    const { text, usage } = await anthropicService.chat(messages, systemPrompt, maxTokens);
    const totalTokens = usage.inputTokens + usage.outputTokens;

    usageService.logUsage(req.user.id, totalTokens, '/api/ai/chat');

    res.json({ reply: text, usage: { ...usage, totalTokens } });
  } catch (e) {
    next(e);
  }
}

module.exports = { chat };
