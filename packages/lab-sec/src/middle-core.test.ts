import { describe, expect, it } from "vitest";
import { BLOCK_KEY, DH_LARGE, DH_SMALL, FIXED_IV, blocksOf, decryptBlocks, deliver, dhExchange, encryptBlock, eveBruteForce, encryptBlocks, hmac, picture, randomIv } from "./middle-core";

describe("block cipher modes", () => {
  const blocks = blocksOf(picture());
  it("the picture has 64 blocks but only a handful of different ones", () => {
    expect(blocks).toHaveLength(64);
    expect(new Set(blocks).size).toBe(10);
    expect(blocks.filter((b) => b === 0)).toHaveLength(32);
  });
  it("ECB keeps every repeat: 10 different cipher blocks; CBC: 64", () => {
    expect(new Set(encryptBlocks(blocks, "ecb", BLOCK_KEY, 0)).size).toBe(10);
    expect(new Set(encryptBlocks(blocks, "cbc", BLOCK_KEY, FIXED_IV)).size).toBe(64);
  });
  it("both modes decrypt back to the picture", () => {
    for (const mode of ["ecb", "cbc"] as const) expect(decryptBlocks(encryptBlocks(blocks, mode, BLOCK_KEY, FIXED_IV), mode, BLOCK_KEY, FIXED_IV)).toEqual(blocks);
  });
  it("the block cipher is a permutation: different blocks, different outputs", () => {
    const outs = new Set(Array.from({ length: 5000 }, (_, i) => encryptBlock(i * 7919, BLOCK_KEY)));
    expect(outs.size).toBe(5000);
  });
  it("CBC with a reused IV repeats itself; a fresh IV does not", () => {
    expect(encryptBlocks(blocks, "cbc", BLOCK_KEY, FIXED_IV)).toEqual(encryptBlocks(blocks, "cbc", BLOCK_KEY, FIXED_IV));
    expect(encryptBlocks(blocks, "cbc", BLOCK_KEY, randomIv(1))[0]).not.toBe(encryptBlocks(blocks, "cbc", BLOCK_KEY, randomIv(2))[0]);
  });
});

describe("HMAC", () => {
  it("matches RFC 4231 test case 2", () => {
    expect(hmac("Jefe", "what do ya want for nothing?")).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
  });
  it("a plain hash is forged by recomputing it; HMAC is not", () => {
    expect(deliver("none", true, false).accepted).toBe(true);
    expect(deliver("hash", true, false).accepted).toBe(false);
    expect(deliver("hash", true, true).accepted).toBe(true);
    expect(deliver("hmac", true, true).accepted).toBe(false);
    expect(deliver("hmac", false, false).accepted).toBe(true);
  });
});

describe("Diffie-Hellman", () => {
  it("p = 23, g = 5, a = 6, b = 15: both sides get 2", () => {
    const x = dhExchange(DH_SMALL.p, DH_SMALL.g, 6, 15, false, false);
    expect([x.A, x.B, x.alice, x.bob]).toEqual([8, 19, 2, 2]);
  });
  it("Eve finds a small secret at once, and gives up on the large group", () => {
    expect(eveBruteForce(DH_SMALL.p, DH_SMALL.g, 8)).toEqual({ found: 6, tries: 6 });
    const A = dhExchange(DH_LARGE.p, DH_LARGE.g, 123_456_789, 987_654_321, false, false).A;
    expect(eveBruteForce(DH_LARGE.p, DH_LARGE.g, A)).toEqual({ found: null, tries: 1_000_000 });
  });
  it("a man in the middle splits the key in two; signed keys stop him", () => {
    const x = dhExchange(DH_SMALL.p, DH_SMALL.g, 6, 15, true, false);
    expect(x.alice).not.toBe(x.bob);
    expect(x.mallory).toEqual([x.alice, x.bob]);
    expect(dhExchange(DH_SMALL.p, DH_SMALL.g, 6, 15, true, true).aborted).toBe(true);
  });
});
