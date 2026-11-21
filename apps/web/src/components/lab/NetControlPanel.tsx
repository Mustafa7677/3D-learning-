"use client";

import { useState } from "react";
import { LINKS, PACKETS, ROUTERS, RTT, cidr, currentTransfer, packetize, sameSubnet, shortestPath, type NetLabAction, type NetLabState } from "@inside-tech/lab-net";
import type { NetFocus } from "../scene/NetScene";
import styles from "./lab.module.css";
import { DnsSection, LanSection, TcpSection } from "./NetMiddleSections";

type D = (a: NetLabAction) => void;

function PacketsSection({ state, dispatch }: { state: NetLabState; dispatch: D }) {
  const p = packetize(state.packets.size, state.packets.mtu);
  return (
    <fieldset className={styles.group}>
      <legend>Пакеттер</legend>
      <div className={styles.row} role="group" aria-label="Хабар өлшемі">
        {[
          [100, "100 Б"],
          [10_000, "10 КБ"],
          [1_000_000, "1 МБ"],
        ].map(([v, label]) => (
          <button key={label} type="button" className="btn" aria-pressed={state.packets.size === v} onClick={() => dispatch({ type: "pkt/set", size: v as number })}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.row} role="group" aria-label="MTU">
        {[576, 1500, 9000].map((m) => (
          <button key={m} type="button" className="btn" aria-pressed={state.packets.mtu === m} onClick={() => dispatch({ type: "pkt/set", mtu: m })}>
            MTU {m}
          </button>
        ))}
      </div>
      <div className={styles.metrics} role="status">
        <div>
          <span>Пакеттер</span>
          <strong>{p.packets.toLocaleString("ru-RU")}</strong>
        </div>
        <div>
          <span>Сымда</span>
          <strong>{p.wireBytes.toLocaleString("ru-RU")} Б</strong>
        </div>
        <div>
          <span>Тиімділік</span>
          <strong>{(p.efficiency * 100).toFixed(1)}%</strong>
        </div>
      </div>
      <p className={styles.small}>Әр пакет: деректер ≤ MTU − 40 (IP 20 + TCP 20) + Ethernet 18 байт.</p>
    </fieldset>
  );
}

function IpSection({ state, dispatch }: { state: NetLabState; dispatch: D }) {
  const [addr, setAddr] = useState(state.ip.addr);
  const [other, setOther] = useState(state.ip.other);
  const c = cidr(state.ip.addr, state.ip.prefix);
  const okOther = cidr(state.ip.other, state.ip.prefix) !== null;
  return (
    <fieldset className={styles.group}>
      <legend>IP калькулятор</legend>
      <form
        className={styles.row}
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "ip/set", addr, other });
        }}
      >
        <label htmlFor="ip-a">Адрес</label>
        <input id="ip-a" className={styles.textInput} value={addr} onChange={(e) => setAddr(e.target.value)} />
        <label htmlFor="ip-b">Екінші адрес</label>
        <input id="ip-b" className={styles.textInput} value={other} onChange={(e) => setOther(e.target.value)} />
        <button type="submit" className="btn btn-primary">
          Есептеу
        </button>
      </form>
      <div className={styles.slider}>
        <label htmlFor="prefix">Префикс (/n)</label>
        <output htmlFor="prefix">/{state.ip.prefix}</output>
        <input id="prefix" type="range" min={8} max={32} value={state.ip.prefix} onChange={(e) => dispatch({ type: "ip/set", prefix: Number(e.target.value) })} />
      </div>
      {c ? (
        <dl className={styles.kv} role="status">
          <dt>Маска</dt>
          <dd>{c.mask}</dd>
          <dt>Желі</dt>
          <dd>{c.network}</dd>
          <dt>Broadcast</dt>
          <dd>{c.broadcast}</dd>
          <dt>Хосттар</dt>
          <dd>
            {c.first} … {c.last} ({c.hosts.toLocaleString("ru-RU")})
          </dd>
          <dt>Екінші адрес</dt>
          <dd>{okOther ? (sameSubnet(state.ip.addr, state.ip.other, state.ip.prefix) ? "бір желіде ✓" : "басқа желіде") : "-"}</dd>
        </dl>
      ) : (
        <p className={styles.small} role="alert">
          Адрес дұрыс емес (мысалы 192.168.1.10)
        </p>
      )}
    </fieldset>
  );
}

function RoutingSection({ state, dispatch }: { state: NetLabState; dispatch: D }) {
  const r = state.routing;
  const res = shortestPath(r.from, r.to, r.failed);
  const last = state.stats.routeRuns.at(-1);
  return (
    <fieldset className={styles.group}>
      <legend>Маршрутизация</legend>
      <div className={styles.row} role="group" aria-label="Алгоритм">
        {(
          [
            ["ls", "Link state (Дейкстра)"],
            ["dv", "Distance vector"],
          ] as const
        ).map(([a, label]) => (
          <button key={a} type="button" className="btn" aria-pressed={r.algo === a} onClick={() => dispatch({ type: "route/algo", algo: a })}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.row}>
        <label htmlFor="r-from">Қайдан</label>
        <select id="r-from" value={r.from} onChange={(e) => dispatch({ type: "route/set", from: e.target.value })}>
          {ROUTERS.map((x) => (
            <option key={x.id}>{x.id}</option>
          ))}
        </select>
        <label htmlFor="r-to">Қайда</label>
        <select id="r-to" value={r.to} onChange={(e) => dispatch({ type: "route/set", to: e.target.value })}>
          {ROUTERS.map((x) => (
            <option key={x.id}>{x.id}</option>
          ))}
        </select>
      </div>
      <div className={styles.row} role="group" aria-label="Сызықтар">
        {LINKS.map((l) => (
          <button key={l.id} type="button" className="btn" aria-pressed={r.failed.includes(l.id)} onClick={() => dispatch({ type: "route/toggle", link: l.id })} aria-label={`${l.id} сызығы (құны ${l.cost})${r.failed.includes(l.id) ? ": үзілген" : ""}`}>
            {l.id}
            {r.failed.includes(l.id) ? " ✕" : ""}
          </button>
        ))}
      </div>
      <p className={styles.small}>Басылған сызық: үзілген.</p>
      {r.algo === "ls" ? (
        <>
          <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "route/send" })}>
            Пакет жіберу
          </button>
          {last && (
            <p className={styles.small} role="status">
              {last.cost < 0 ? `${last.from} → ${last.to}: жол жоқ` : `${last.path.join(" → ")} · құны ${last.cost}`}
            </p>
          )}
          {!last && <p className={styles.small}>Қазір ең арзан: {res.path.length ? `${res.path.join(" → ")} (${res.cost})` : "жол жоқ"}</p>}
        </>
      ) : (
        <div className={styles.slider}>
          <label htmlFor="dv-rounds">Раунд</label>
          <output htmlFor="dv-rounds">{r.rounds}</output>
          <input id="dv-rounds" type="range" min={0} max={8} value={r.rounds} onChange={(e) => dispatch({ type: "route/rounds", rounds: Number(e.target.value) })} />
        </div>
      )}
    </fieldset>
  );
}

function TransportSection({ state, dispatch }: { state: NetLabState; dispatch: D }) {
  const tr = state.transport;
  const res = currentTransfer(state);
  return (
    <fieldset className={styles.group}>
      <legend>Сенімді жеткізу ({PACKETS} пакет, RTT = {RTT})</legend>
      <div className={styles.row} role="group" aria-label="Протокол">
        {(
          [
            ["stopwait", "Stop-and-wait"],
            ["window", "Жылжымалы терезе"],
          ] as const
        ).map(([p, label]) => (
          <button key={p} type="button" className="btn" aria-pressed={tr.protocol === p} onClick={() => dispatch({ type: "tx/set", protocol: p })}>
            {label}
          </button>
        ))}
      </div>
      {tr.protocol === "window" && (
        <div className={styles.slider}>
          <label htmlFor="tx-w">Терезе (W)</label>
          <output htmlFor="tx-w">{tr.window}</output>
          <input id="tx-w" type="range" min={1} max={30} value={tr.window} onChange={(e) => dispatch({ type: "tx/set", window: Number(e.target.value) })} />
        </div>
      )}
      <div className={styles.slider}>
        <label htmlFor="tx-loss">Жоғалту</label>
        <output htmlFor="tx-loss">{Math.round(tr.loss * 100)}%</output>
        <input id="tx-loss" type="range" min={0} max={0.3} step={0.05} value={tr.loss} onChange={(e) => dispatch({ type: "tx/set", loss: Number(e.target.value) })} />
      </div>
      <div className={styles.row}>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "tx/run" })}>
          Жіберу
        </button>
        <button type="button" className="btn" disabled={!tr.ran || !tr.playing} onClick={() => dispatch({ type: "tx/finish" })}>
          Соңына дейін
        </button>
      </div>
      {tr.ran && (
        <div className={styles.metrics} role="status">
          <div>
            <span>Уақыт</span>
            <strong>{res.time}</strong>
          </div>
          <div>
            <span>Пайдалану</span>
            <strong>{Math.round(res.utilization * 100)}%</strong>
          </div>
          <div>
            <span>Қайта жіберу</span>
            <strong>{res.retransmits}</strong>
          </div>
        </div>
      )}
    </fieldset>
  );
}

function CongestionSection({ state, dispatch }: { state: NetLabState; dispatch: D }) {
  const c = state.congestion;
  return (
    <fieldset className={styles.group}>
      <legend>Кептелісті басқару (40 RTT)</legend>
      <div className={styles.row} role="group" aria-label="Нұсқа">
        {(["reno", "tahoe"] as const).map((v) => (
          <button key={v} type="button" className="btn" aria-pressed={c.variant === v} onClick={() => dispatch({ type: "cc/set", variant: v })}>
            {v === "reno" ? "TCP Reno" : "TCP Tahoe"}
          </button>
        ))}
      </div>
      <div className={styles.slider}>
        <label htmlFor="cc-cap">Арна сыйымдылығы (пакет/RTT)</label>
        <output htmlFor="cc-cap">{c.capacity}</output>
        <input id="cc-cap" type="range" min={4} max={60} value={c.capacity} onChange={(e) => dispatch({ type: "cc/set", capacity: Number(e.target.value) })} />
      </div>
      <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: "cc/run" })}>
        Іске қосу
      </button>
      {c.ran && <p className={styles.small}>Қызыл бағандар: жоғалту болған RTT-лар.</p>}
    </fieldset>
  );
}

function NatSection({ state, dispatch }: { state: NetLabState; dispatch: D }) {
  const [port, setPort] = useState("40000");
  return (
    <fieldset className={styles.group}>
      <legend>NAT</legend>
      <div className={styles.row}>
        {["192.168.1.10", "192.168.1.11", "192.168.1.12"].map((h) => (
          <button key={h} type="button" className="btn" onClick={() => dispatch({ type: "nat/out", host: h, port: 51000 })}>
            {h} → сайт
          </button>
        ))}
      </div>
      <form
        className={styles.row}
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "nat/in", port: Number(port) });
        }}
      >
        <label htmlFor="nat-port">Сырттан келген пакет, порт</label>
        <input id="nat-port" className={styles.numInput} type="number" value={port} onChange={(e) => setPort(e.target.value)} />
        <button type="submit" className="btn">
          Жеткізу
        </button>
      </form>
      <ul className={styles.notes} role="status">
        {state.nat.log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <button type="button" className="btn" onClick={() => dispatch({ type: "nat/reset" })}>
        Кестені тазалау
      </button>
    </fieldset>
  );
}

export function NetControlPanel({ state, focus, dispatch, canUndo, onUndo }: { state: NetLabState; focus: NetFocus; dispatch: D; canUndo: boolean; onUndo(): void }) {
  return (
    <aside className={styles.controls} aria-label="Басқару панелі">
      {focus === "packets" && <PacketsSection state={state} dispatch={dispatch} />}
      {focus === "ip" && <IpSection state={state} dispatch={dispatch} />}
      {focus === "routing" && <RoutingSection state={state} dispatch={dispatch} />}
      {focus === "transport" && <TransportSection state={state} dispatch={dispatch} />}
      {focus === "congestion" && <CongestionSection state={state} dispatch={dispatch} />}
      {focus === "nat" && <NatSection state={state} dispatch={dispatch} />}
      {focus === "dns" && <DnsSection state={state} dispatch={dispatch} />}
      {focus === "tcp" && <TcpSection state={state} dispatch={dispatch} />}
      {focus === "lan" && <LanSection state={state} dispatch={dispatch} />}
      <div className={styles.row}>
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          Соңғы әрекетті болдырмау
        </button>
      </div>
    </aside>
  );
}
