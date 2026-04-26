import { describe, it, expect, beforeAll } from "vitest";

const TEST_KEY = "a".repeat(64);
beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

const { encrypt, decrypt } = await import("./crypto");

describe("crypto — encrypt/decrypt", () => {
  it("roundtrip returns original plaintext", () => {
    const plain = "sk-ant-api03-super-secret";
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it("same plaintext produces different ciphertext each call (random IV)", () => {
    const ct1 = encrypt("same");
    const ct2 = encrypt("same");
    expect(ct1).not.toBe(ct2);
  });

  it("ciphertext has 3 colon-separated parts; IV is 24 hex chars, tag is 32", () => {
    const parts = encrypt("hello").split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24);
    expect(parts[1]).toHaveLength(32);
  });

  it("tampered ciphertext throws on decrypt", () => {
    const parts = encrypt("secret").split(":");
    const tampered = parts[0] + ":" + parts[1] + ":" + "ff".repeat(parts[2].length / 2);
    expect(() => decrypt(tampered)).toThrow();
  });

  it("wrong format (no colons) throws descriptive error", () => {
    expect(() => decrypt("notvalidformat")).toThrow(/Invalid ciphertext format/);
  });

  it("missing ENCRYPTION_KEY throws descriptive error", () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt("x")).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = saved;
  });
});
