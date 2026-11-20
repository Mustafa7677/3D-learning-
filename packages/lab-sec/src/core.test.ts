import { describe, expect, it } from "vitest";
import { crack, login, strength, USERS, escapeHtml, isXss } from "./attacks";
import { N, bitDistance, caesar, fromUtf8, guessShift, modPow, rsaKeys, sha256, toHex, utf8, xorBytes } from "./crypto";
import { LONG_TEXT, PSET_SHIFT } from "./text";

describe("classical ciphers", () => {
  it("Caesar over the 42-letter Kazakh alphabet round-trips and keeps case and punctuation", () => {
    expect(N).toBe(42);
    const c = caesar("Сәлем, Әлем!", 3);
    expect(c).not.toBe("Сәлем, Әлем!");
    expect(caesar(c, -3)).toBe("Сәлем, Әлем!");
    expect(caesar("я", 1)).toBe("а");
  });
  it("frequency analysis recovers the key of a long text", () => {
    for (const k of [1, 9, PSET_SHIFT, 41]) expect(guessShift(caesar(LONG_TEXT, k))).toBe(k);
  });
  it("XOR with the same key twice restores the message; reusing a pad leaks the XOR of messages", () => {
    const key = utf8("секрет");
    const m = utf8("қазан");
    expect(fromUtf8(xorBytes(xorBytes(m, key), key))).toBe("қазан");
    const a = utf8("HELLO");
    const b = utf8("WORLD");
    const k = utf8("XQZPT");
    expect(toHex(xorBytes(xorBytes(a, k), xorBytes(b, k)))).toBe(toHex(xorBytes(a, b)));
  });
});

describe("SHA-256", () => {
  it("matches the FIPS 180-4 test vectors", () => {
    expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });
  it("one changed letter flips about half of the 256 bits (avalanche)", () => {
    const d = bitDistance(sha256("Сәлем"), sha256("Сәлем!"));
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(166);
  });
});

describe("RSA", () => {
  it("the textbook example: p = 61, q = 53, e = 17 → d = 2753", () => {
    const k = rsaKeys(61, 53, 17);
    expect(k).toMatchObject({ n: 3233, phi: 3120, d: 2753 });
    if ("error" in k) throw new Error();
    const c = modPow(65, k.e, k.n);
    expect(c).toBe(2790);
    expect(modPow(c, k.d, k.n)).toBe(65);
    // A signature is "encrypting" with the private key; anyone verifies with the public key.
    expect(modPow(modPow(123, k.d, k.n), k.e, k.n)).toBe(123);
  });
  it("rejects bad parameters", () => {
    expect(rsaKeys(60, 53, 17)).toHaveProperty("error");
    expect(rsaKeys(61, 53, 15)).toHaveProperty("error");
  });
});

describe("passwords", () => {
  it("plain text leaks everything; unsalted hashes fall to one dictionary pass and reveal shared passwords", () => {
    expect(crack("plain").cracked).toHaveLength(5);
    const h = crack("hash");
    expect(h.cracked.map((c) => c.name).sort()).toEqual(["aigerim", "asel", "erlan", "nurlan"]);
    expect(h.work).toBe(50);
    expect(h.sameHashGroups).toEqual([["aigerim", "erlan"]]);
  });
  it("salt forces a separate pass per user; slow hashing multiplies every guess", () => {
    const s = crack("salted");
    expect(s.cracked).toHaveLength(4);
    expect(s.work).toBeGreaterThan(crack("hash").work);
    expect(crack("slow").work).toBe(s.work * 1000);
  });
  it("strength: dictionary words are weak no matter their length", () => {
    expect(strength("qazaqstan").inDictionary).toBe(true);
    expect(strength("qazaqstan").bits).toBeLessThan(6);
    expect(strength("Kökjiek-Tau!91").bits).toBeGreaterThan(80);
    expect(USERS.length).toBe(5);
  });
});

describe("injection", () => {
  it("string concatenation lets ' OR '1'='1 and admin'-- in; parameters do not", () => {
    expect(login("admin", "S3cure!Pass", false)).toMatchObject({ ok: true, as: "admin", injected: false });
    expect(login("admin", "wrong", false).ok).toBe(false);
    expect(login("' OR '1'='1", "' OR '1'='1", false)).toMatchObject({ ok: true, as: "admin", injected: true });
    expect(login("admin'--", "x", false)).toMatchObject({ ok: true, as: "admin", injected: true });
    expect(login("dana'--", "x", false)).toMatchObject({ ok: true, as: "dana", injected: true });
    expect(login("' OR '1'='1", "' OR '1'='1", true).ok).toBe(false);
    expect(login("admin'--", "x", true).ok).toBe(false);
    expect(login("o'brien", "x", false).ok).toBe(false);
  });
  it("escaping turns markup into text", () => {
    expect(isXss("<script>alert(1)</script>")).toBe(true);
    expect(isXss('<img src=x onerror="alert(1)">')).toBe(true);
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(isXss("Сәлем!")).toBe(false);
  });
});
