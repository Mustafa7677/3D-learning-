import { describe, expect, it } from "vitest";
import { FAULTS, scenarioChain, verifyChain } from "./certs";

const run = (f: (typeof FAULTS)[number]) => {
  const { chain, trust } = scenarioChain(f);
  return verifyChain(chain, trust, "inside.kz");
};

describe("certificate chain", () => {
  it("a good chain: name, dates, two signatures, a trusted root", () => {
    const v = run("none");
    expect(v).toMatchObject({ ok: true, error: null });
    expect(v.checks.filter((c) => c.what.startsWith("Қолтаңба"))).toHaveLength(2);
  });
  it("each fault gets its own browser error", () => {
    expect(run("missingIntermediate").error).toBe("UNKNOWN_ISSUER");
    expect(run("expired").error).toBe("EXPIRED");
    expect(run("wrongHost").error).toBe("NAME_MISMATCH");
    expect(run("selfSigned").error).toBe("SELF_SIGNED");
    expect(run("tampered").error).toBe("BAD_SIGNATURE");
    expect(run("untrustedRoot").error).toBe("UNKNOWN_ISSUER");
  });
  it("www is covered by the SAN list, a foreign host is not", () => {
    const { chain, trust } = scenarioChain("none");
    expect(verifyChain(chain, trust, "www.inside.kz").ok).toBe(true);
    expect(verifyChain(chain, trust, "mail.inside.kz").error).toBe("NAME_MISMATCH");
  });
});
