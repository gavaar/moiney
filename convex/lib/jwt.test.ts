import {
  createPublicKey,
  generateKeyPairSync,
  verify,
} from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { signAccessToken } from "./jwt";
import { createPublicJwk } from "./jwtPublic";

function generatePemKeyPair() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

const originalEnvironment = {
  privateKey: process.env.JWT_PRIVATE_KEY,
  publicKey: process.env.JWT_PUBLIC_KEY,
  siteUrl: process.env.CONVEX_SITE_URL,
};

afterEach(() => {
  if (originalEnvironment.privateKey === undefined) {
    delete process.env.JWT_PRIVATE_KEY;
  } else {
    process.env.JWT_PRIVATE_KEY = originalEnvironment.privateKey;
  }
  if (originalEnvironment.publicKey === undefined) {
    delete process.env.JWT_PUBLIC_KEY;
  } else {
    process.env.JWT_PUBLIC_KEY = originalEnvironment.publicKey;
  }
  if (originalEnvironment.siteUrl === undefined) {
    delete process.env.CONVEX_SITE_URL;
  } else {
    process.env.CONVEX_SITE_URL = originalEnvironment.siteUrl;
  }
});

describe("signAccessToken", () => {
  it("rejects mismatched signing and verification keys", () => {
    const signingPair = generatePemKeyPair();
    const verificationPair = generatePemKeyPair();
    process.env.JWT_PRIVATE_KEY = signingPair.privateKey;
    process.env.JWT_PUBLIC_KEY = verificationPair.publicKey;
    process.env.CONVEX_SITE_URL = "https://example.convex.site";

    expect(() => signAccessToken("user-1", "session-1")).toThrow(
      "JWT key pair does not match",
    );
  });

  it("issues a token verifiable by the generated public JWK", async () => {
    const keyPair = generatePemKeyPair();
    process.env.JWT_PRIVATE_KEY = keyPair.privateKey;
    process.env.JWT_PUBLIC_KEY = keyPair.publicKey;
    process.env.CONVEX_SITE_URL = "https://example.convex.site";

    const token = signAccessToken("user-1", "session-1");
    const [header, payload, signature] = token.split(".");
    const jwk = await createPublicJwk(keyPair.publicKey);
    const verificationKey = createPublicKey({ key: jwk, format: "jwk" });

    expect(
      verify(
        "RSA-SHA256",
        Buffer.from(`${header}.${payload}`),
        verificationKey,
        Buffer.from(signature, "base64url"),
      ),
    ).toBe(true);
  });
});
