/**
 * Robotics & IoT, Middle level models: PWM driving a DC motor, serial buses
 * (UART framing, I2C addresses, SPI speed) and real-time scheduling (a
 * superloop versus preemptive priorities). Deterministic and pinned by tests.
 */

// ---------------- PWM ----------------

export const SUPPLY_V = 12;
/** The motor's mechanical time constant, seconds. */
export const MOTOR_TAU = 0.02;
export const PWM_FREQS = [20, 200, 2000, 20000];

export interface PwmResult {
  /** Average voltage the motor feels. */
  avgV: number;
  /** Peak-to-peak ripple of the motor's speed, as a share of full speed. */
  ripple: number;
  /** Audible whine below 20 kHz. */
  audible: boolean;
  /** Speed over two PWM periods in steady state (share of full speed), for the chart. */
  wave: number[];
}

/**
 * A first-order motor driven by a square wave. In steady state the speed
 * swings between two values; the swing has a closed form.
 */
export function pwm(duty: number, freq: number): PwmResult {
  const T = 1 / freq;
  const a = Math.exp((-duty * T) / MOTOR_TAU);
  const b = Math.exp((-(1 - duty) * T) / MOTOR_TAU);
  const e = Math.exp(-T / MOTOR_TAU);
  // Low point (start of the on-phase) and high point (end of it), as a share of full speed.
  const low = duty === 0 ? 0 : duty === 1 ? 1 : ((1 - a) * b) / (1 - e);
  const high = duty === 0 ? 0 : duty === 1 ? 1 : 1 - (1 - low) * a;
  const wave: number[] = [];
  for (let k = 0; k < 40; k++) {
    const ph = (k % 20) / 20;
    if (ph < duty) wave.push(1 - (1 - low) * Math.exp((-ph * T) / MOTOR_TAU));
    else wave.push(high * Math.exp((-(ph - duty) * T) / MOTOR_TAU));
  }
  return { avgV: SUPPLY_V * duty, ripple: high - low, audible: freq < 20000, wave };
}

// ---------------- serial buses ----------------

export const UART_BAUDS = [9600, 115200];

/** 8N1 framing: start bit (0), 8 data bits LSB first, stop bit (1). Idle line is 1. */
export function uartFrame(bytes: number[]): number[] {
  return bytes.flatMap((b) => [0, ...Array.from({ length: 8 }, (_, i) => (b >> i) & 1), 1]);
}

/**
 * The receiver waits for a falling edge, then samples the middle of each of
 * its own bit times. If the two sides disagree on the baud rate, it samples
 * the wrong bits.
 */
export function uartReceive(bytes: number[], txBaud: number, rxBaud: number): { bytes: number[]; framingErrors: number } {
  const bits = uartFrame(bytes);
  const line = (t: number) => {
    const i = Math.floor(t * txBaud);
    return i < 0 || i >= bits.length ? 1 : bits[i]!;
  };
  const end = bits.length / txBaud;
  const out: number[] = [];
  let framingErrors = 0;
  let t = 0;
  const step = 1 / (txBaud * 16);
  while (t < end) {
    if (line(t) === 1) {
      t += step;
      continue;
    }
    // Start bit seen at t: sample bit k at t + (k + 0.5) / rxBaud.
    let byte = 0;
    for (let k = 0; k < 8; k++) byte |= line(t + (k + 1.5) / rxBaud) << k;
    if (line(t + 9.5 / rxBaud) !== 1) framingErrors++;
    out.push(byte);
    t += 10 / rxBaud;
  }
  return { bytes: out, framingErrors };
}

export const enc = (s: string) => [...s].map((c) => c.charCodeAt(0) & 0xff);
export const dec = (b: number[]) => b.map((x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : "·")).join("");

export type Bus = "uart" | "i2c" | "spi";
export const BUS_CLOCK: Record<Bus, number> = { uart: 9600, i2c: 400_000, spi: 8_000_000 };

/** Seconds to move `n` bytes: UART 10 bits a byte; I2C 9 clocks a byte plus the address byte; SPI 8 clocks a byte. */
export function transferTime(bus: Bus, n: number): number {
  if (bus === "uart") return (n * 10) / BUS_CLOCK.uart;
  if (bus === "i2c") return ((n + 1) * 9) / BUS_CLOCK.i2c;
  return (n * 8) / BUS_CLOCK.spi;
}

/** Two sensors share an I2C bus. Same address: both answer, the data is garbage. */
export function i2cRead(addrA: number, addrB: number, target: number): { ok: boolean; answered: number } {
  const answered = [addrA, addrB].filter((a) => a === target).length;
  return { ok: answered === 1, answered };
}

// ---------------- real-time scheduling ----------------

export interface Task {
  id: string;
  period: number; // ms, also the deadline
  cost: number; // ms of CPU per release
}

export const TASKS = (loggerCost: number): Task[] => [
  { id: "control", period: 10, cost: 2 },
  { id: "sensor", period: 20, cost: 4 },
  { id: "logger", period: 100, cost: loggerCost },
];
export const HORIZON = 200;

export type Scheduler = "superloop" | "priority";

export interface Schedule {
  /** Which task ran in each millisecond ("" = idle). */
  timeline: string[];
  misses: Record<string, number>;
  utilization: number;
}

/**
 * superloop: whenever the CPU is free, run the first ready task in the fixed
 * order and let it finish (no preemption). priority: every millisecond the
 * ready task with the shortest period runs (rate monotonic, preemptive).
 * A job that has not finished by its next release misses its deadline.
 */
export function schedule(kind: Scheduler, tasks: Task[]): Schedule {
  const left = new Map<string, number>(); // remaining cost of the current job
  const misses: Record<string, number> = Object.fromEntries(tasks.map((t) => [t.id, 0]));
  const timeline: string[] = [];
  let running: string | null = null;
  for (let t = 0; t < HORIZON; t++) {
    for (const task of tasks)
      if (t % task.period === 0) {
        if ((left.get(task.id) ?? 0) > 0) misses[task.id]!++;
        left.set(task.id, task.cost);
      }
    const ready = tasks.filter((task) => (left.get(task.id) ?? 0) > 0);
    let pick: Task | undefined;
    if (kind === "priority") pick = [...ready].sort((a, b) => a.period - b.period)[0];
    else pick = running && (left.get(running) ?? 0) > 0 ? tasks.find((x) => x.id === running) : ready[0];
    if (pick) {
      left.set(pick.id, left.get(pick.id)! - 1);
      running = pick.id;
      timeline.push(pick.id);
    } else {
      running = null;
      timeline.push("");
    }
  }
  return { timeline, misses, utilization: tasks.reduce((s, x) => s + x.cost / x.period, 0) };
}
