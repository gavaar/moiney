import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPublicJwk } from "./jwtPublic";

describe("createPublicJwk", () => {
  it("exports only public verification fields", async () => {
    const { publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const jwk = await createPublicJwk(publicKey);

    expect(Object.keys(jwk).sort()).toEqual([
      "alg",
      "e",
      "kid",
      "kty",
      "n",
      "use",
    ]);
    expect(jwk).toMatchObject({
      alg: "RS256",
      kid: "moiney-key-v1",
      kty: "RSA",
      use: "sig",
    });
  });
});
