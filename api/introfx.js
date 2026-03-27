export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method==='OPTIONS'){ res.status(200).end(); return; }

  const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
  const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
  const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
  const R2_BUCKET = 'myth-universe';
  const R2_PUBLIC = 'https://pub-928be8961edc4bd294392b36f9a41216.r2.dev';

  try {
    const crypto = await import('crypto');
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:-]|\.\d{3}/g,'').slice(0,15)+'Z';
    const dateOnly = dateStr.slice(0,8);
    function hmac(key, data){ return crypto.createHmac('sha256', key).update(data).digest(); }
    const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const path = `/${R2_BUCKET}`;
    const prefix = 'Intro-soundeffects/';
    const query = `max-keys=100&prefix=${encodeURIComponent(prefix)}`;
    const emptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${emptyHash}\nx-amz-date:${dateStr}\n`;
    const canonicalRequest = `GET\n${path}\n${query}\n${canonicalHeaders}\n${signedHeaders}\n${emptyHash}`;
    const credentialScope = `${dateOnly}/auto/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${dateStr}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${R2_SECRET_KEY}`, dateOnly), 'auto'), 's3'), 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(`https://${host}${path}?${query}`, {
      headers: { host, 'x-amz-date': dateStr, 'x-amz-content-sha256': emptyHash, Authorization: authorization }
    });
    const text = await response.text();
    const matches = text.matchAll(/<Key>([^<]+\.(?:mp3|wav|ogg|m4a))<\/Key>/gi);
    const tracks = [];
    for(const m of matches) tracks.push(`${R2_PUBLIC}/${m[1]}`);

    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json({ tracks });
  } catch(err) {
    res.status(500).json({ error: err.message, tracks: [] });
  }
}
