import { describe, expect, it } from "vitest";
import { digestToHex, sha256Hex } from "@/lib/evaluation/content-hash";

describe("digestToHex", () => {
  it("encodes bytes as lowercase hex", () => {
    const buf = new Uint8Array([0x0a, 0xff, 0x00]).buffer;
    expect(digestToHex(buf)).toBe("0aff00");
  });
});

describe("sha256Hex", () => {
  it("hashes known input", async () => {
    const bytes = new TextEncoder().encode("hello");
    // echo -n hello | shasum -a 256
    expect(await sha256Hex(bytes)).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });

  it("differs for different content", async () => {
    const a = await sha256Hex(new TextEncoder().encode("a"));
    const b = await sha256Hex(new TextEncoder().encode("b"));
    expect(a).not.toBe(b);
  });
});
