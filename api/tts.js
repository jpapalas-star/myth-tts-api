export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({error:'Method not allowed'}); return; }

  try {
    // Safety: Vercel auto-parses JSON body, but guard against edge cases
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }
    if (!body) {
      res.status(400).json({error:'Empty body'}); return;
    }

    const { text, voice_id } = body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({error:'Missing or empty text'}); return;
    }
    if (text.length > 5000) {
      res.status(400).json({error:'Text too long (max 5000)'}); return;
    }

    const voiceId = voice_id || 'KDImLuG6RkuyuX5httC7'; // Takis - Greek Male

    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!elRes.ok) {
      const errText = await elRes.text();
      console.error(`ElevenLabs error ${elRes.status}:`, errText);
      // Return the actual EL status so client can decide what to do
      res.status(elRes.status).json({
        error: `ElevenLabs ${elRes.status}`,
        detail: errText
      });
      return;
    }

    const audioBuffer = await elRes.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    res.status(200).json({ audio: base64Audio, contentType: 'audio/mpeg' });

  } catch (err) {
    console.error('TTS handler error:', err);
    res.status(500).json({error: err.message});
  }
}
