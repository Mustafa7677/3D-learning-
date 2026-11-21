import { describe, expect, it } from "vitest";
import { TASKS, dec, enc, i2cRead, pwm, schedule, transferTime, uartReceive } from "./middle-core";

describe("PWM", () => {
  it("duty sets the average voltage: 50% of 12 V is 6 V", () => {
    expect(pwm(0.5, 2000).avgV).toBe(6);
    expect(pwm(0.25, 2000).avgV).toBe(3);
  });
  it("at 50% duty the speed ripple is 55% at 20 Hz, 6% at 200 Hz, 0.6% at 2 kHz, 0.06% at 20 kHz", () => {
    expect(pwm(0.5, 20).ripple).toBeCloseTo(0.5546, 3);
    expect(pwm(0.5, 200).ripple).toBeCloseTo(0.0624, 3);
    expect(pwm(0.5, 2000).ripple).toBeCloseTo(0.0062, 3);
    expect(pwm(0.5, 20000).ripple).toBeCloseTo(0.0006, 3);
    expect(pwm(0.5, 20000).audible).toBe(false);
  });
});

describe("serial buses", () => {
  it("UART: same baud reads HELLO; a mismatch reads garbage", () => {
    expect(dec(uartReceive(enc("HELLO"), 9600, 9600).bytes)).toBe("HELLO");
    expect(dec(uartReceive(enc("HELLO"), 9600, 115200).bytes)).not.toContain("HELLO");
    expect(dec(uartReceive(enc("HELLO"), 9600, 10000).bytes)).toBe("HELLO");
  });
  it("1 KB: UART 9600 about 1067 ms, I2C 400 kHz 23 ms, SPI 8 MHz about 1 ms", () => {
    expect(transferTime("uart", 1024) * 1000).toBeCloseTo(1066.67, 1);
    expect(transferTime("i2c", 1024) * 1000).toBeCloseTo(23.06, 1);
    expect(transferTime("spi", 1024) * 1000).toBeCloseTo(1.02, 1);
  });
  it("two sensors at 0x76 both answer; moving one to 0x77 fixes it", () => {
    expect(i2cRead(0x76, 0x76, 0x76)).toEqual({ ok: false, answered: 2 });
    expect(i2cRead(0x76, 0x77, 0x76)).toEqual({ ok: true, answered: 1 });
  });
});

describe("real-time scheduling", () => {
  it("a 30 ms logger in a superloop makes control miss 4 deadlines; priorities: none", () => {
    expect(schedule("superloop", TASKS(30)).misses).toEqual({ control: 4, sensor: 2, logger: 0 });
    expect(schedule("priority", TASKS(30)).misses).toEqual({ control: 0, sensor: 0, logger: 0 });
    expect(schedule("priority", TASKS(30)).utilization).toBeCloseTo(0.7, 9);
  });
  it("overload (U = 1.1): priorities sacrifice only the logger", () => {
    expect(schedule("priority", TASKS(70)).misses).toEqual({ control: 0, sensor: 0, logger: 1 });
    expect(schedule("superloop", TASKS(70)).misses).toEqual({ control: 12, sensor: 6, logger: 0 });
  });
});
