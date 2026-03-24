export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({error:'Method not allowed'}); return; }

  try {
    const { text, voice_id } = req.body;
    if (!text || text.length > 5000) { res.status(400).json({error:'Invalid text'}); return; }

    const voiceId = voice_id || 'KDImLuG6RkuyuX5httC7'; // Iordanis - Greek Male

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text,
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

    if (!response.ok) {
      const err = await response.text();
      res.status(response.status).json({error: err});
      return;
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    res.status(200).json({ audio: base64Audio, contentType: 'audio/mpeg' });

  } catch (err) {
    res.status(500).json({error: err.message});
  }
}
