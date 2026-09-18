import { describe, expect, it } from "vitest";

import { isHttpsUrl, resolveTenantLogoUrl } from "../logo";

const REAL =
  "https://x.supabase.co/storage/v1/object/public/trainer-logos/t/logo.png";
const BLOB =
  "blob:https://app.topcoach.io/39d5e669-5ac5-4609-9063-22c525b313ac";

describe("isHttpsUrl", () => {
  it("accepts https and rejects blob:, data:, http: and junk", () => {
    expect(isHttpsUrl(REAL)).toBe(true);
    expect(isHttpsUrl(BLOB)).toBe(false);
    expect(isHttpsUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isHttpsUrl("http://insecure.test/logo.png")).toBe(false);
    expect(isHttpsUrl("logo.png")).toBe(false);
    expect(isHttpsUrl("")).toBe(false);
    expect(isHttpsUrl(null)).toBe(false);
  });
});

describe("resolveTenantLogoUrl", () => {
  it("prefers the logo_url column when it is a real URL", () => {
    expect(
      resolveTenantLogoUrl(REAL, { logo: { url: "https://other/x.png" } })
    ).toBe(REAL);
  });

  it("skips a persisted blob: preview and falls back to the theme's logo (the joangarcia case)", () => {
    const theme = {
      assets: { logo: BLOB },
      logo: { url: REAL },
      meta: { logoUrl: REAL },
    };

    expect(resolveTenantLogoUrl(BLOB, theme)).toBe(REAL);
  });

  it("walks assets.logo, logo.url and meta.logoUrl in that order", () => {
    expect(resolveTenantLogoUrl(null, { assets: { logo: REAL } })).toBe(REAL);
    expect(resolveTenantLogoUrl(null, { logo: { url: REAL } })).toBe(REAL);
    expect(resolveTenantLogoUrl(null, { meta: { logoUrl: REAL } })).toBe(REAL);
  });

  it("returns an empty string when nothing usable is stored", () => {
    expect(resolveTenantLogoUrl(BLOB, { assets: { logo: BLOB } })).toBe("");
    expect(resolveTenantLogoUrl(null, null)).toBe("");
    expect(resolveTenantLogoUrl(undefined, {})).toBe("");
  });
});
