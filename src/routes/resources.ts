import type { Hono } from 'hono';

function error(message: string) {
  return { error: 'invalid_resource_input', message };
}

export function registerResourceValidation(app: Hono): void {
  app.use('/api/resources/weather', async (c, next) => {
    const city = (c.req.query('city') ?? 'Bangalore').trim();
    if (!city || city.length > 80) return c.json(error('city must contain 1 to 80 characters.'), 400);
    await next();
  });
  app.use('/api/resources/company-lookup', async (c, next) => {
    const name = (c.req.query('name') ?? 'Algorand Foundation').trim();
    if (!name || name.length > 120) return c.json(error('name must contain 1 to 120 characters.'), 400);
    await next();
  });
  app.use('/api/resources/sentiment-score', async (c, next) => {
    const body: { text?: unknown } = await c.req.json<{ text?: unknown }>().catch(() => ({}));
    if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 5_000) {
      return c.json(error('text must contain 1 to 5000 characters.'), 400);
    }
    await next();
  });
}

export function registerResourceHandlers(app: Hono): void {
  app.get('/api/resources/weather', c => {
    const city = (c.req.query('city') ?? 'Bangalore').trim();
    return c.json({
      city,
      temperature: 28,
      condition: 'Partly cloudy',
      humidity: 61,
      simulated: true,
      generatedAt: new Date().toISOString(),
    });
  });
  app.get('/api/resources/company-lookup', c => {
    const name = (c.req.query('name') ?? 'Algorand Foundation').trim();
    return c.json({
      name,
      founded: 2017,
      industry: 'Blockchain',
      headquarters: 'Singapore',
      status: 'Active',
      simulated: true,
    });
  });
  app.post('/api/resources/sentiment-score', async c => {
    const body = await c.req.json<{ text: string }>();
    const normalized = body.text.toLowerCase();
    const positive = ['secure', 'scalable', 'excellent', 'fast', 'helpful', 'good'].filter(word =>
      normalized.includes(word),
    ).length;
    const negative = ['bad', 'slow', 'unsafe', 'broken', 'poor'].filter(word => normalized.includes(word)).length;
    const score = Math.max(-1, Math.min(1, (positive - negative) / Math.max(1, positive + negative)));
    return c.json({
      score,
      label: score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral',
      confidence: Number((0.65 + Math.min(positive + negative, 3) * 0.09).toFixed(2)),
      simulated: true,
    });
  });
}
