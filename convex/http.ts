import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { createPublicJwk } from "./lib/jwtPublic";

const http = httpRouter();

function requireEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export const getOpenIdConfiguration = httpAction(async () => {
  const url = requireEnvironmentValue("CONVEX_SITE_URL");
  return new Response(
    JSON.stringify({
      issuer: url,
      jwks_uri: `${url}/.well-known/jwks.json`,
      id_token_signing_alg_values_supported: ["RS256"],
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});

export const getJwks = httpAction(async () => {
  const publicKey = requireEnvironmentValue("JWT_PUBLIC_KEY");
  const jwk = await createPublicJwk(publicKey);
  return new Response(JSON.stringify({ keys: [jwk] }), {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json",
    },
  });
});

http.route({
  path: "/.well-known/openid-configuration",
  method: "GET",
  handler: getOpenIdConfiguration,
});

http.route({
  path: "/.well-known/jwks.json",
  method: "GET",
  handler: getJwks,
});

export default http;
