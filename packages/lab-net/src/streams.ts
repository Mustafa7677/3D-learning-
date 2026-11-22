/**
 * TCP, QUIC and UDP side by side: twelve packets over three streams (page,
 * style, image), one of them lost. TCP hands bytes to the app strictly in
 * order; QUIC keeps order only inside each stream; UDP hands over whatever
 * arrives and never resends.
 */

export type Transport = "tcp" | "quic" | "udp";
export const STREAMS = ["A", "B", "C"] as const;
export const PKT_GAP = 5; // ms between sends
export const ONE_WAY = 20; // ms
/** Extra time for a lost packet: the sender's timeout plus the resend. */
export const RETRANSMIT = 60;
export const PKT_COUNT = 12;
/** The packet the network drops: the second one, which belongs to stream B. */
export const LOST = 1;

export interface StreamRun {
  packets: { stream: string; sent: number; delivered: number | null }[];
  /** When each stream had all its data (null: a hole stayed, UDP). */
  finish: Record<string, number | null>;
  /** Longest wait from send to delivery to the app. */
  maxDelay: number;
  lost: number;
}

export function runStreams(proto: Transport, loss: boolean): StreamRun {
  const sent = Array.from({ length: PKT_COUNT }, (_, i) => ({ stream: STREAMS[i % 3]!, sent: i * PKT_GAP }));
  const arrival = sent.map((p, i) => (loss && i === LOST ? (proto === "udp" ? null : p.sent + ONE_WAY + RETRANSMIT) : p.sent + ONE_WAY));
  const packets = sent.map((p, i) => {
    const a = arrival[i];
    if (a === null || a === undefined) return { ...p, delivered: null };
    // In-order delivery waits for every earlier packet it depends on.
    const before = arrival.slice(0, i + 1).filter((_, j) => proto === "tcp" || (proto === "quic" && sent[j]!.stream === p.stream) || j === i);
    return { ...p, delivered: Math.max(...before.map((x) => x ?? 0)) };
  });
  const finish: Record<string, number | null> = {};
  for (const s of STREAMS) {
    const mine = packets.filter((p) => p.stream === s);
    finish[s] = mine.some((p) => p.delivered === null) ? null : Math.max(...mine.map((p) => p.delivered!));
  }
  const delays = packets.filter((p) => p.delivered !== null).map((p) => p.delivered! - p.sent);
  return { packets, finish, maxDelay: Math.max(...delays), lost: packets.filter((p) => p.delivered === null).length };
}
