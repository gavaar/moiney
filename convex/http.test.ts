import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createPublicJwk } from "./lib/jwtPublic";
import { getJwks } from "./http";

const originalPublicKey = process.env.JWT_PUBLIC_KEY;

afterEach(() => {
  if (originalPublicKey === undefined) delete process.env.JWT_PUBLIC_KEY;
  else process.env.JWT_PUBLIC_KEY = originalPublicKey;
});

describe("JWKS HTTP action", () => {
  it("serves the configured public key with cache headers", async () => {
    const { publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    process.env.JWT_PUBLIC_KEY = publicKey;

    const response = await (getJwks as any)._handler(
      {},
      new Request("https://example.convex.site/.well-known/jwks.json"),
    );
    const body = await response.json();
    const expectedKey = await createPublicJwk(publicKey);

    expect(body).toEqual({ keys: [expectedKey] });
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=3600",
    );
  });
});
