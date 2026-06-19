const MODEL = 'gemini-2.5-flash';

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function sanitizeObstacle(item, offsetX) {
  const kind = ['block', 'spike', 'saw', 'spikedBlock'].includes(item?.kind) ? item.kind : 'block';
  const width = clampNumber(item?.width, 28, 110);
  const height = clampNumber(item?.height, 26, 360);
  const x = clampNumber(item?.x, 0, 2400) + offsetX;
  const maxY = kind === 'spike' ? 540 : 514;
  const y = clampNumber(item?.y, 0, maxY);
  const color = typeof item?.color === 'string' && /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : '#243b53';
  const direction = item?.direction === 'down' ? 'down' : 'up';

  return { kind, direction, x, y, width, height, color };
}

function sanitizeOrb(item, offsetX) {
  return {
    x: clampNumber(item?.x, 0, 2400) + offsetX,
    y: clampNumber(item?.y, 76, 430),
    radius: clampNumber(item?.radius, 10, 18),
  };
}

function extractJson(text) {
  const cleaned = String(text || '').replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return JSON.parse(cleaned.slice(start, end + 1));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    return;
  }

  try {
    const body = req.body || {};
    const mode = ['wave', 'flipWave', 'laser', 'orbit', 'ship', 'ufo'].includes(body.mode) ? body.mode : 'wave';
    const fromX = clampNumber(body.fromX, 900, 500000);
    const segmentLength = clampNumber(body.segmentLength, 1600, 3200);
    const seed = clampNumber(body.seed, 1, 999999);

    const prompt = [
      'Return only valid JSON for a hard endless Geometry Dash style level segment.',
      `Mode: ${mode}. Canvas: 960x540. Floor starts at y=488. Player travels left to right.`,
      `Create hazards for local x coordinates 0..${segmentLength}; leave x 0..220 empty.`,
      'Use obstacles with kind block, spike, saw, or spikedBlock.',
      'Keep a playable path but make it hard. Avoid impossible sealed walls.',
      'For spikes use y=0 direction=down or y=452 direction=up.',
      'Use colors #243b53, #7c314f, #3d2c8d, #6842c2, #d9e2ec, #8f3d58, #2f4f74.',
      'Schema: {"obstacles":[{"kind":"block","x":300,"y":0,"width":64,"height":180,"color":"#243b53"}],"orbs":[{"x":800,"y":260,"radius":14}]}',
      `Seed: ${seed}.`,
    ].join('\n');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: {
            temperature: 0.9,
            responseMimeType: 'application/json',
          },
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    );

    if (!response.ok) {
      res.status(response.status).json({ error: `Gemini request failed: ${response.status}` });
      return;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = extractJson(text) || {};
    const obstacles = Array.isArray(parsed.obstacles)
      ? parsed.obstacles.slice(0, 42).map((item) => sanitizeObstacle(item, fromX))
      : [];
    const orbs = mode === 'ufo' && Array.isArray(parsed.orbs)
      ? parsed.orbs.slice(0, 8).map((item) => sanitizeOrb(item, fromX))
      : [];

    res.status(200).json({ obstacles, orbs });
  } catch (error) {
    res.status(500).json({ error: String(error?.message || error) });
  }
}
