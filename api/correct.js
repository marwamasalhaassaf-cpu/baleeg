// api/correct.js
// نسخة تجريبية مجانية تستخدم Google Gemini بدل Claude
// مفتاح الـ API يبقى محفوظاً في إعدادات Vercel (GEMINI_API_KEY) ولا يظهر في كود الموقع

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    res.status(500).json({
      error: 'GEMINI_API_KEY غير معرّف. أضيفيه من إعدادات Vercel (Environment Variables) ثم أعيدي النشر (Redeploy).'
    });
    return;
  }

  try {
    const body = req.body || {};
    const system = body.system || '';
    const messages = body.messages || [];

    // نحول رسائل الموقع (بصيغة Anthropic) إلى صيغة Gemini
    const parts = [];
    for (const msg of messages) {
      const content = msg.content;
      if (typeof content === 'string') {
        parts.push({ text: content });
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text') {
            parts.push({ text: block.text });
          } else if (block.type === 'image' && block.source) {
            parts.push({
              inline_data: {
                mime_type: block.source.media_type,
                data: block.source.data
              }
            });
          }
        }
      }
    }

    const geminiBody = {
      contents: [{ role: 'user', parts }],
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {})
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody)
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      res.status(geminiRes.status).json({ error: data.error?.message || 'خطأ من Gemini API' });
      return;
    }

    // نستخرج النص من رد Gemini ونعيده بنفس شكل رد Claude
    // حتى لا نحتاج لتعديل أي شيء في index.html
    const text = (data.candidates?.[0]?.content?.parts || [])
      .map(p => p.text || '')
      .join('');

    res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (err) {
    res.status(500).json({ error: 'فشل الاتصال بـ Gemini API', details: err.message });
  }
}
