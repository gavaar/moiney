import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

const JWKS = {
  keys: [
    {
      kty: "RSA",
      n: "wI6XTNoVB-UFG0x01-sf65lFfijuYXcEhsxyBZdPHeX8Y5Ku8hVPtb7uS5-fwbvEb-H71RXK4mv6IU_eQgRQpK6VyNBy-pjbaNQIt2juHLT7ZPodutnUjFj3zJepoGbTO_d7eYy_SGfvwFs4frfwXn9nJuqMs1WdmBVcOhegG02bkejpw-ONAPLkRwktvY1R84AJ2niTQNdWRmmrXWVt79WQapNbPAJJpb9Tbdxe0d4UHX3l5PsHIQSJ9ANkbaQNTZxxl-YgfsRcXbx5Gm_8ZJwcaUVRw34Qgi-5pUwYkUgb-IePpSnGWOw4c6v0c75nDXKFssADZV_TPyPikGdUXQ",
      e: "AQAB",
      use: "sig",
      alg: "RS256",
      kid: "moiney-key-v1",
    },
  ],
};

http.route({
  path: "/.well-known/openid-configuration",
  method: "GET",
  handler: httpAction(async (_ctx, _request) => {
    const url = process.env.CONVEX_SITE_URL!;
    return new Response(
      JSON.stringify({
        issuer: url,
        jwks_uri: `${url}/.well-known/jwks.json`,
        id_token_signing_alg_values_supported: ["RS256"],
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }),
});

http.route({
  path: "/.well-known/jwks.json",
  method: "GET",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(JSON.stringify(JWKS), {
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
