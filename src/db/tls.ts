import { X509Certificate } from "node:crypto";
import { checkServerIdentity } from "node:tls";
import { LOOPBACK_HOSTS, type DatabaseCredential } from "./connection-url";

/** D-94: no encryption-only TLS; operators supply the Supabase trust anchor. */
export function databaseTls(key: DatabaseCredential, host: string) {
  if ((key === "DATABASE_URL_TEST" || process.env.NODE_ENV === "test") &&
      LOOPBACK_HOSTS.some(value => value === host || value === `[${host}]`)) return false;
  const ca = process.env.SUPABASE_DB_CA_CERT;
  try {
    if (!ca) throw new Error();
    const blocks = ca.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
    if (!blocks?.length || ca.replace(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g, "").trim()) throw new Error();
    for (const block of blocks) {
      const certificate = new X509Certificate(block);
      if (!certificate.ca || Date.parse(certificate.validFrom) > Date.now() ||
          Date.parse(certificate.validTo) <= Date.now()) throw new Error();
    }
  } catch {
    throw new Error("SUPABASE_DB_CA_CERT: a valid current Supabase CA certificate is required");
  }
  return { ca: ca!, rejectUnauthorized: true, servername: host, checkServerIdentity };
}
