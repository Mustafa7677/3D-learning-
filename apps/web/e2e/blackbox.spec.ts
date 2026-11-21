import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

const sw = (page: Page, name: "A" | "B") => page.getByRole("switch", { name: new RegExp(`^${name} =`) });
const readout = (page: Page) => page.getByText(/^A=\d · B=\d · Шам=\d/);

test("black box: from the architecture lab, experiment, a wrong circuit, its counterexample, a reload, the fix, the box opens", async ({ page }) => {
  await page.goto("/labs/arch");
  await page.getByRole("link", { name: "Қара жәшік ойыны" }).click();
  await expect(page).toHaveURL(/\/blackbox$/, { timeout: 20000 });
  await expect(page.getByRole("button", { name: /Қос кілт/ })).toContainText("бастау үшін");

  await page.getByRole("navigation", { name: "Жәшіктер" }).getByRole("button", { name: /Дәліз шамы/ }).click();
  await expect(page.getByText("Шам қай кезде жанатынын анықта. Содан кейін дәл солай жұмыс істейтін сұлба құрастыр.")).toBeVisible();

  // A on: the lamp lights. B on too: it goes dark, the surprise.
  await sw(page, "A").click();
  await expect(readout(page)).toContainText("A=1 · B=0 · Шам=1");
  await page.getByRole("button", { name: "Нәтижені жазу" }).click();
  await sw(page, "B").click();
  await expect(readout(page)).toContainText("A=1 · B=1 · Шам=0");
  await page.getByRole("button", { name: "Нәтижені жазу" }).click();
  const rows = page.locator("table tbody tr");
  await expect(rows).toHaveCount(2);
  // The same combination again marks the earlier row instead of adding one.
  await page.getByRole("button", { name: "Нәтижені жазу" }).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toHaveAttribute("data-flash", "true");

  // A deliberately wrong guess: A OR B.
  await page.getByRole("button", { name: "OR элементін қосу" }).click();
  await expect(page.getByText("Сенің өрнегің: Шам = A OR B")).toBeVisible();
  await page.getByRole("button", { name: "Тексеру" }).click();
  const alert = page.getByRole("region", { name: "Сенің сұлбаң" }).getByRole("alert");
  await expect(alert).toContainText("A=1, B=1 кезінде сенің шамың жанды, жәшіктің шамы сөнді.");
  await sw(page, "A").click();
  await alert.getByRole("button", { name: "Осы жағдайды құрылғыға қою" }).click();
  await expect(readout(page)).toContainText("A=1 · B=1 · Шам=0");
  await expect(page.getByText("Сенің шамың: 1")).toBeVisible();

  // The unfinished work survives a reload.
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Жәшіктер" }).getByRole("button", { name: /Дәліз шамы/ })).toHaveAttribute("aria-pressed", "true");
  await expect(rows).toHaveCount(2);
  await expect(page.getByText("Сенің өрнегің: Шам = A OR B")).toBeVisible();

  // Fix it: (A OR B) AND NOT (A AND B), from the three familiar gates only.
  await expect(page.getByRole("button", { name: "XOR элементін қосу" })).toHaveCount(0);
  await page.getByRole("button", { name: "AND элементін қосу" }).click();
  await page.getByLabel("Э2: бірінші кіріс").selectOption("A");
  await page.getByLabel("Э2: екінші кіріс").selectOption("B");
  await page.getByRole("button", { name: "NOT элементін қосу" }).click();
  await page.getByRole("button", { name: "AND элементін қосу" }).click();
  await page.getByLabel("Э4: екінші кіріс").selectOption("g1");
  await expect(page.getByText("Сенің өрнегің: Шам = NOT (A AND B) AND (A OR B)")).toBeVisible();
  await page.getByRole("button", { name: "Тексеру" }).click();
  await expect(page.getByRole("heading", { name: /A XOR B/ })).toBeVisible();
  await expect(page.getByText("Сен жасаған сұлба да екі қосқыштың дәл біреуі қосылғанда шамды жағады. Бұл әрекет XOR деп аталады.")).toBeVisible();
  await expect(page.getByRole("figure", { name: "Сенің сұлбаң" })).toBeVisible();
  await expect(page.getByRole("figure", { name: "Жәшіктің іші" }).first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Жәшіктер" }).getByRole("button", { name: /Дәліз шамы/ })).toContainText("ашылды");

  // Solved stays solved.
  await page.reload();
  await expect(page.getByRole("heading", { name: /A XOR B/ })).toBeVisible();
});

test("black box: fixing one input turns a wrong alarm into the right one", async ({ page }) => {
  await page.goto("/blackbox");
  await page.getByRole("navigation", { name: "Жәшіктер" }).getByRole("button", { name: /Күзет сигналы/ }).click();
  await page.getByRole("button", { name: "NOT элементін қосу" }).click();
  await page.getByLabel("Э1: кіріс").selectOption("B");
  await page.getByRole("button", { name: "AND элементін қосу" }).click();
  // A AND B: one input away from the answer.
  await page.getByLabel("Э2: бірінші кіріс").selectOption("A");
  await page.getByLabel("Э2: екінші кіріс").selectOption("B");
  await page.getByRole("button", { name: "Тексеру" }).click();
  await expect(page.getByRole("region", { name: "Сенің сұлбаң" }).getByRole("alert")).toContainText("кезінде сенің шамың");
  await page.getByLabel("Э2: екінші кіріс").selectOption("g1");
  await page.getByRole("button", { name: "Тексеру" }).click();
  await expect(page.getByRole("heading", { name: "Шам = A AND NOT B" })).toBeVisible();
});

test("black box on a 320px phone: the device first, then the table and the editor, all by touch", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto("/blackbox");
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  const device = (await page.getByRole("region", { name: "Құрылғы" }).boundingBox())!;
  const table = (await page.getByRole("heading", { name: "Тәжірибе кестесі" }).boundingBox())!;
  const editor = (await page.getByRole("heading", { name: "Сенің сұлбаң" }).boundingBox())!;
  expect(device.y).toBeLessThan(table.y);
  expect(table.y).toBeLessThan(editor.y);
  expect(device.x + device.width).toBeLessThanOrEqual(320);
  await sw(page, "A").tap();
  await sw(page, "B").tap();
  await expect(readout(page)).toContainText("A=1 · B=1 · Шам=1");
  await page.getByRole("button", { name: "AND элементін қосу" }).tap();
  await page.getByRole("button", { name: "Тексеру" }).tap();
  await expect(page.getByRole("heading", { name: "Шам = A AND B" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await ctx.close();
});

test("black box by keyboard alone", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/blackbox");
  const reach = async (name: RegExp) => {
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      const label = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return (el?.getAttribute("aria-label") ?? el?.textContent ?? "").trim();
      });
      if (name.test(label)) return;
    }
    throw new Error(`Tab never reached ${name}`);
  };
  await reach(/^A =/);
  await page.keyboard.press("Space");
  await reach(/^B =/);
  await page.keyboard.press("Space");
  await expect(readout(page)).toContainText("A=1 · B=1");
  await reach(/^AND элементін қосу$/);
  await page.keyboard.press("Enter");
  await reach(/^Тексеру$/);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Шам = A AND B" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("keyboard-320.png") });
});

test("corridor restores the experiment and accepts the sum-of-products circuit", async ({ page }, testInfo) => {
  await page.goto("/blackbox");
  const nav = page.getByRole("navigation", { name: "Жәшіктер" });
  const corridor = nav.getByRole("button", { name: /Дәліз шамы/ });
  await corridor.click();
  const record = page.getByRole("button", { name: "Нәтижені жазу" });
  await record.click();
  await sw(page, "A").click();
  await record.click();
  const add = (type: string) => page.getByRole("button", { name: type + " элементін қосу" }).click();
  await add("NOT");
  await page.getByLabel("Э1: кіріс").selectOption("B");
  await add("AND");
  await page.getByRole("button", { name: "Ишара", exact: true }).click();
  const assertDraft = async () => {
    await expect(corridor).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("tbody tr")).toHaveCount(2);
    await expect(page.getByLabel("Э1: кіріс")).toHaveValue("B");
    await expect(page.getByLabel("Э2: бірінші кіріс")).toHaveValue("g1");
    await expect(page.getByRole("button", { name: "Тағы бір ишара" })).toBeVisible();
  };
  await page.reload();
  await assertDraft();
  await nav.getByRole("button", { name: /Қос кілт/ }).click();
  await corridor.click();
  await assertDraft();
  await add("NOT");
  await page.getByLabel("Э3: кіріс").selectOption("A");
  await add("AND");
  await page.getByLabel("Э4: екінші кіріс").selectOption("B");
  await add("OR");
  await page.getByLabel("Э5: екінші кіріс").selectOption("g2");
  await page.getByRole("button", { name: "Тексеру" }).click();
  await expect(page.getByRole("heading", { name: /A XOR B/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("alternate-xor.png") });
});

test("corrupt saves recover and unknown gates are discarded", async ({ page }) => {
  await page.goto("/blackbox");
  for (const raw of ["{", JSON.stringify({current: "alarm", boxes: {alarm: {hint: 1, build: {parts: [{id:"g1",type:"XOR",in:["A","B"]}],out:"g1"}}}})]) {
    await page.evaluate(value => localStorage.setItem("inside-tech:blackbox", value), raw);
    await page.reload();
    await expect(page.getByText("Сенің өрнегің: Шам = A", {exact:true})).toBeVisible();
    if (raw !== "{") await expect(page.getByRole("button", {name:"Тағы бір ишара"})).toBeVisible();
  }
});
