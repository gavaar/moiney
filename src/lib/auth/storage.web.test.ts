// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "./storage.web";

describe("web auth storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("keeps auth tokens in tab-scoped session storage", async () => {
    await setRefreshToken("refresh-token");
    await setAccessToken("access-token");

    expect(await getRefreshToken()).toBe("refresh-token");
    expect(await getAccessToken()).toBe("access-token");
    expect(sessionStorage.getItem("refresh_token_random_value")).toBe(
      "refresh-token",
    );
    expect(sessionStorage.getItem("access_token")).toBe("access-token");
    expect(localStorage.length).toBe(0);
  });
});
