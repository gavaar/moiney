export const JWT_KEY_ID = "moiney-key-v1";

export type PublicJwk = {
  kty: "RSA";
  n: string;
  e: string;
  use: "sig";
  alg: "RS256";
  kid: string;
};

function decodePublicKeyPem(publicKeyPem: string): ArrayBuffer {
  const base64 = publicKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s/g, "");

  if (!base64) throw new Error("JWT_PUBLIC_KEY is invalid");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

export async function createPublicJwk(
  publicKeyPem: string,
): Promise<PublicJwk> {
  const key = await crypto.subtle.importKey(
    "spki",
    decodePublicKeyPem(publicKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["verify"],
  );
  const exported = await crypto.subtle.exportKey("jwk", key);

  if (exported.kty !== "RSA" || !exported.n || !exported.e) {
    throw new Error("JWT_PUBLIC_KEY must be an RSA public key");
  }

  return {
    kty: "RSA",
    n: exported.n,
    e: exported.e,
    use: "sig",
    alg: "RS256",
    kid: JWT_KEY_ID,
  };
}
