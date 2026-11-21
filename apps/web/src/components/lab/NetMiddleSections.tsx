"use client";

import { useState } from "react";
import { DNS_NAMES, LAN_HOSTS, pendingResend, type NetLabAction, type NetLabState, type Side } from "@inside-tech/lab-net";
import styles from "./lab.module.css";

type D = (a: NetLabAction) => void;

export function DnsSection({ state, dispatch }: { state: NetLabState; dispatch: D }) {
  const d = state.dns;
  const last = d.last;
  const live = d.cache.filter((e) => e.expires > d.clock);
  return (
    <fieldset className={styles.group}>
      <legend>DNS резолвер · сағат {d.clock} с</legend>
      <div className={styles.row} role="group" aria-label="Атауды сұрау">
        {DNS_NAMES.map((n) => (
          <button key={n} type="button" className="btn" onClick={() => dispatch({ type: "dns/resolve", name: n })}>
            {n} сұрау
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <button type="button" className="btn" onClick={() => dispatch({ type: "dns/advance", seconds: 60 })}>
          Уақыт +60 с
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "dns/advance", seconds: 300 })}>
          Уақыт +300 с
        </button>
        <button type="button" className="btn" disabled={d.moved} onClick={() => dispatch({ type: "dns/move" })}>
          {d.moved ? "Сайт көшті ✓" : "Сайтты жаңа IP-ге көшіру"}
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "dns/flush" })}>
          Кэшті тазалау
        </button>
      </div>
      {last && (
        <div role="status" aria-label="Соңғы жауап">
          <div className={styles.metrics}>
            <div>
              <span>Жауап</span>
              <strong>{last.ip ?? "NXDOMAIN"}</strong>
            </div>
            <div>
              <span>Уақыт</span>
              <strong>{last.ms} мс</strong>
            </div>
            <div>
              <span>Серверлер</span>
              <strong>{last.hops.length - 1}</strong>
            </div>
          </div>
          <ol className={styles.notes}>
            {last.hops.map((h, i) => (
              <li key={i}>
                {h.label}: {h.answer} · {h.ms} мс
              </li>
            ))}
          </ol>
          {last.stale && <p className={styles.small}>⚠ Кэштегі адрес ескі: authoritative сервер қазір басқа адрес береді.</p>}
        </div>
      )}
      <p className={styles.small}>Резолвер кэші ({live.length} жазба):</p>
      <ul className={styles.notes} aria-label="Резолвер кэші">
        {live.map((e) => (
          <li key={e.key}>
            {e.key} → {e.value} · тағы {e.expires - d.clock} с
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

const SIDE: Record<Side, string> = { client: "Клиент", server: "Сервер" };

export function TcpSection({ state, dispatch }: { state: NetLabState; dispatch: D }) {
  const t = state.tcp;
  const ev = (event: Extract<NetLabAction, { type: "tcp/event" }>["event"]) => dispatch({ type: "tcp/event", event });
  const head = t.wire[0];
  return (
    <fieldset className={styles.group}>
      <legend>TCP күйлер машинасы</legend>
      <div className={styles.metrics} role="status" aria-label="Күйлер">
        <div>
          <span>Клиент</span>
          <strong>{t.client}</strong>
        </div>
        <div>
          <span>Сервер</span>
          <strong>{t.server}</strong>
        </div>
        <div>
          <span>Жолда</span>
          <strong>{t.wire.length ? t.wire.map((s) => s.flag).join(", ") : "бос"}</strong>
        </div>
      </div>
      <div className={styles.row} role="group" aria-label="Қолданба">
        <button type="button" className="btn" disabled={t.server !== "CLOSED"} onClick={() => ev({ kind: "listen" })}>
          Сервер: listen()
        </button>
        <button type="button" className="btn" disabled={t.client !== "CLOSED"} onClick={() => ev({ kind: "connect" })}>
          Клиент: connect()
        </button>
        {(["client", "server"] as const).map((side) => (
          <button key={side} type="button" className="btn" disabled={t[side] !== "ESTABLISHED" && t[side] !== "CLOSE_WAIT"} onClick={() => ev({ kind: "close", side })}>
            {SIDE[side]}: close()
          </button>
        ))}
      </div>
      <div className={styles.row} role="group" aria-label="Желі">
        <button type="button" className="btn btn-primary" disabled={!head} onClick={() => ev({ kind: "deliver" })}>
          {head ? `Жеткізу: ${head.flag} (${SIDE[head.from]} жіберген)` : "Жолда сегмент жоқ"}
        </button>
        <button type="button" className="btn" disabled={!head} onClick={() => ev({ kind: "drop" })}>
          Сегментті жоғалту
        </button>
      </div>
      <div className={styles.row} role="group" aria-label="Таймерлер">
        {(["client", "server"] as const).map((side) => {
          const st = t[side];
          const what = st === "TIME_WAIT" ? "2·MSL өтті" : pendingResend(st) ? `${pendingResend(st)} қайталау` : null;
          return (
            <button key={side} type="button" className="btn" disabled={!what} onClick={() => ev({ kind: "timer", side })}>
              {SIDE[side]} таймері{what ? `: ${what}` : ""}
            </button>
          );
        })}
        <button type="button" className="btn" onClick={() => dispatch({ type: "tcp/reset" })}>
          Басынан бастау
        </button>
      </div>
      <ol className={styles.notes} aria-label="TCP журналы">
        {t.log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
    </fieldset>
  );
}

const TARGETS = [...LAN_HOSTS.map((h) => h.ip), "8.8.8.8", "1.1.1.1"];

export function LanSection({ state, dispatch }: { state: NetLabState; dispatch: D }) {
  const [from, setFrom] = useState("A");
  const [to, setTo] = useState("192.168.1.11");
  const l = state.lan;
  const me = LAN_HOSTS.find((h) => h.id === from)!;
  return (
    <fieldset className={styles.group}>
      <legend>Ethernet коммутатор · 192.168.1.0/24</legend>
      <form
        className={styles.row}
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "lan/send", from, to });
        }}
      >
        <label htmlFor="lan-from">Кімнен</label>
        <select id="lan-from" value={from} onChange={(e) => setFrom(e.target.value)}>
          {LAN_HOSTS.map((h) => (
            <option key={h.id} value={h.id}>
              {h.id} ({h.ip})
            </option>
          ))}
        </select>
        <label htmlFor="lan-to">Кімге (IP)</label>
        <select id="lan-to" value={to} onChange={(e) => setTo(e.target.value)}>
          {TARGETS.filter((ip) => ip !== me.ip).map((ip) => (
            <option key={ip} value={ip}>
              {ip}
              {LAN_HOSTS.find((h) => h.ip === ip) ? ` (${LAN_HOSTS.find((h) => h.ip === ip)!.id})` : " (сыртта)"}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary">
          Пакетті жіберу
        </button>
      </form>
      <div className={styles.row}>
        <button type="button" className="btn" onClick={() => dispatch({ type: "lan/age" })}>
          Коммутатор кестесін ұмыту
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: "lan/reset" })}>
          Бәрін тазалау
        </button>
      </div>
      {l.frames.length > 0 && (
        <ol className={styles.notes} role="status" aria-label="Соңғы кадрлар">
          {l.frames.map((f, i) => (
            <li key={i}>
              {f.kind === "data" ? "Деректер" : f.kind === "arp-request" ? "ARP сұрауы" : "ARP жауабы"}: {f.note} · {f.flooded ? `барлық портқа (${f.outPorts.join(", ")})` : `${f.outPorts[0]}-портқа`}
            </li>
          ))}
        </ol>
      )}
      <dl className={styles.kv}>
        <dt>MAC кестесі</dt>
        <dd>
          {Object.keys(l.macTable).length
            ? Object.entries(l.macTable)
                .map(([mac, port]) => `${LAN_HOSTS.find((h) => h.mac === mac)?.id ?? mac}: ${port}`)
                .join(" · ")
            : "бос"}
        </dd>
        <dt>{from} ARP кэші</dt>
        <dd>
          {Object.keys(l.arp[from] ?? {}).length
            ? Object.keys(l.arp[from]!)
                .map((ip) => `${ip} → ${LAN_HOSTS.find((h) => h.ip === ip)?.id ?? "?"}`)
                .join(" · ")
            : "бос"}
        </dd>
      </dl>
    </fieldset>
  );
}
