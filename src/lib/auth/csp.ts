export function privateCsp(nonce:string,url:string|undefined,development:boolean) {
  let connect = "";
  try { if (url) connect = new URL(url).origin; } catch { /* Invalid config never becomes policy text. */ }
  // D-40 strict script nonce; inline styles retained for framework style attributes.
  return `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development?" 'unsafe-eval'":""}; style-src 'self' 'unsafe-inline'; connect-src 'self' ${connect}${development?" ws: wss:":""}; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self' ${connect} https://accounts.google.com; frame-ancestors 'none'`;
}
