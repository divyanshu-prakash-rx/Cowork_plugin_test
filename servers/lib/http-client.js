// Minimal HTTP/HTTPS client built on Node.js built-ins. No npm dependencies.
// Used by every module that needs to talk to Phinite over HTTP(S).

const http  = require('http');
const https = require('https');

class HttpError extends Error {
  constructor(status, method, url, body) {
    super(`HTTP ${status} ${method} ${url}: ${String(body).slice(0, 300)}`);
    this.status = status;
    this.method = method;
    this.url    = url;
    this.body   = body;
  }
}

// Low-level request. Accepts either a path (resolved against `baseUrl`) or a
// full URL. Always JSON. `headers` is merged with the defaults.
function request(method, urlOrPath, { baseUrl = '', body = undefined, headers = {} } = {}) {
  const fullUrl = /^https?:\/\//i.test(urlOrPath)
    ? urlOrPath
    : `${baseUrl}${urlOrPath}`;

  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(fullUrl); }
    catch (e) { return reject(new Error(`Invalid URL: ${fullUrl}`)); }

    const lib    = u.protocol === 'https:' ? https : http;
    const bodyStr = body != null ? JSON.stringify(body) : undefined;

    const finalHeaders = {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
      ...headers,
    };
    if (bodyStr) finalHeaders['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = lib.request({
      hostname: u.hostname,
      port:     u.port || (u.protocol === 'https:' ? 443 : 80),
      path:     u.pathname + (u.search || ''),
      method,
      headers:  finalHeaders,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
        } else {
          reject(new HttpError(res.statusCode, method, fullUrl, data));
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = { request, HttpError };
