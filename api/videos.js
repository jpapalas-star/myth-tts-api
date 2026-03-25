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

  const prefixes = [
    'landing/1landRuins/',
    'landing/2landExistingCiv/',
    'landing/3landJungle/',
    'searching/1SearchingRuins/',
    'searching/2SearchingExistingCiv/',
    'searching/3SearchingJungle/'
  ];

  async function listPrefix(prefix) {
    const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}?prefix=${encodeURIComponent(prefix)}&max-keys=100`;
    
    // AWS Signature v4
    const now = new Date();
    const dateStr = now.toISOString().replace(/[:-]|\.\d{3}/g,'').slice(0,15)+'Z';
    const dateOnly = dateStr.slice(0,8);
    
    const crypto = await import('crypto');
    
    function hmac(key, data) {
      return crypto.createHmac('sha256', key).update(data).digest();
    }
    function sign(key, data) {
      return hmac(key, data);
    }
    
    const host = `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const path = `/${R2_BUCKET}`;
    const query = `max-keys=100&prefix=${encodeURIComponent(prefix)}`;
    const headers = { host, 'x-amz-date': dateStr, 'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' };
    
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\nx-amz-date:${dateStr}\n`;
    const canonicalRequest = `GET\n${path}\n${query}\n${canonicalHeaders}\n${signedHeaders}\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
    
    const credentialScope = `${dateOnly}/auto/s3/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${dateStr}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
    
    const signingKey = sign(sign(sign(sign(`AWS4${R2_SECRET_KEY}`, dateOnly), 'auto'), 's3'), 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    
    const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    const response = await fetch(`https://${host}${path}?${query}`, {
      headers: { ...headers, Authorization: authorization }
    });
    
    const text = await response.text();
    const matches = text.matchAll(/<Key>([^<]+\.(?:mp4|webm|mov))<\/Key>/gi);
    const files = [];
    for(const m of matches) files.push(m[1]);
    return files;
  }

  try {
    const result = { landing: {1:[],2:[],3:[]}, searching: {1:[],2:[],3:[]} };
    
    for(const prefix of prefixes) {
      const files = await listPrefix(prefix);
      const urls = files.map(f => `${R2_PUBLIC}/${f}`);
      
      if(prefix.startsWith('landing')) {
        const t = prefix.includes('1land')?1:prefix.includes('2land')?2:3;
        result.landing[t] = urls;
      } else {
        const t = prefix.includes('1Search')||prefix.includes('1search')?1:prefix.includes('2Search')||prefix.includes('2search')?2:3;
        result.searching[t] = urls;
      }
    }
    
    // Cache for 1 hour
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json(result);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
