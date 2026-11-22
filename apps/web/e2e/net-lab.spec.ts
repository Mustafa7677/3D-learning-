import { expect, test, type Page } from "@playwright/test";
import { nextStep } from "./helpers";

const objective = (page: Page, text: string | RegExp) => page.locator("li[data-done]", { hasText: text });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("networks lab page lists the Junior lessons, the problem set and the Middle level", async ({ page }) => {
  await page.goto("/labs/net");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Computer Networks");
  await expect(page.locator("ol li")).toHaveCount(14);
  await expect(page.locator('ol li[data-level="Middle"]')).toHaveCount(5);
});

test("Middle 10: DNS goes root, TLD, zone; then the cache answers in 10 ms", async ({ page }) => {
  await page.goto("/labs/net/net-10-dns");
  const card = page.getByRole("region", { name: "Алдымен болжа" });
  await card.getByRole("button", { name: /Тек біреуіне/ }).click();
  const ask = (name: string) => page.getByRole("button", { name: `${name} сұрау`, exact: true }).click();
  const answer = page.getByRole("status", { name: "Соңғы жауап" });
  await ask("inside.kz");
  await expect(answer).toContainText("100 мс");
  await expect(objective(page, "Бос кэшпен")).toHaveAttribute("data-done", "true");
  await ask("inside.kz");
  await expect(answer).toContainText("10 мс");
  await ask("api.inside.kz");
  await expect(answer).toContainText("30 мс");
  await expect(objective(page, "басқа атауды")).toHaveAttribute("data-done", "true");
  await expect(card.getByRole("status")).toContainText("Болжамың расталды");
});

test("Middle 11: a closed port answers RST, a listening one completes the handshake", async ({ page }) => {
  await page.goto("/labs/net/net-11-tcp-states");
  await page.getByRole("button", { name: "Клиент: connect()" }).click();
  await page.getByRole("button", { name: /^Жеткізу: SYN/ }).click();
  await page.getByRole("button", { name: /^Жеткізу: RST/ }).click();
  await expect(objective(page, "RST келеді")).toHaveAttribute("data-done", "true");
  await page.getByRole("button", { name: "Сервер: listen()" }).click();
  await page.getByRole("button", { name: "Клиент: connect()" }).click();
  for (const flag of ["SYN", "SYN-ACK", "ACK"]) await page.getByRole("button", { name: new RegExp(`^Жеткізу: ${flag} `) }).click();
  await expect(page.getByRole("status", { name: "Күйлер" })).toContainText("ESTABLISHED");
  await expect(objective(page, "ESTABLISHED-ке жеткіз")).toHaveAttribute("data-done", "true");
});

test("Middle 12: the first packet floods an ARP request, the second goes to one port", async ({ page }) => {
  await page.goto("/labs/net/net-12-switch");
  await page.getByRole("button", { name: "Пакетті жіберу" }).click();
  const frames = page.getByRole("status", { name: "Соңғы кадрлар" });
  await expect(frames).toContainText("ARP сұрауы: 192.168.1.11 кімде? · барлық портқа (1, 3, 4)");
  await page.getByRole("button", { name: "Пакетті жіберу" }).click();
  await expect(frames.locator("li")).toHaveCount(1);
  await expect(frames).toContainText("3-портқа");
  await expect(objective(page, "Тағы жібер")).toHaveAttribute("data-done", "true");
});

test("lesson 2: the CIDR calculator finds the network", async ({ page }) => {
  await page.goto("/labs/net/net-2-ip");
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByLabel("Префикс (/n)").fill("26");
  await expect(page.getByRole("status").filter({ hasText: "192.168.10.64" })).toBeVisible();
  await expect(objective(page, "192.168.10.77/26")).toHaveAttribute("data-done", "true");
});

test("lesson 3: a cut link reroutes the packet", async ({ page }) => {
  await page.goto("/labs/net/net-3-routing");
  await page.getByRole("button", { name: "Пакет жіберу" }).click();
  await expect(page.getByText("A → B → D → F · құны 8")).toBeVisible();
  await page.getByRole("button", { name: /^BD сызығы/ }).click();
  await page.getByRole("button", { name: "Пакет жіберу" }).click();
  await expect(page.getByText("A → B → C → E → D → F · құны 9")).toBeVisible();
});

test("lesson 6: a window of one RTT fills the link", async ({ page }) => {
  await page.goto("/labs/net/net-6-window");
  await page.getByLabel("Терезе (W)").fill("10");
  await page.getByRole("button", { name: "Жіберу", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "85%" })).toBeVisible();
  await expect(objective(page, "≥ 80% пайдалан")).toHaveAttribute("data-done", "true");
});

test("Middle 13: one lost packet holds all TCP streams; QUIC holds only its own", async ({ page }) => {
  await page.goto("/labs/net/net-13-quic");
  const r = page.getByRole("status", { name: "Ағындар нәтижесі" });
  await page.getByRole("button", { name: "Бетті жүктеу" }).click();
  await expect(r).toContainText("бет (A)85 мс");
  await page.getByRole("button", { name: "QUIC" }).click();
  await page.getByRole("button", { name: "Бетті жүктеу" }).click();
  await expect(r).toContainText("бет (A)65 мс");
  await expect(objective(page, "тек жоғалған пакеттің ағыны")).toHaveAttribute("data-done", "true");
});

test("Middle 14: fragments, PMTU discovery, a black hole and MSS clamping", async ({ page }) => {
  await page.goto("/labs/net/net-14-mtu");
  const send = page.getByRole("button", { name: "Пакетті жіберу" });
  const r = page.getByRole("status", { name: "Әрекеттер" });
  await send.click();
  await expect(r).toContainText("1500 Б: бөлшектенді, 2 бөлік");
  await page.getByLabel("DF: бөлшектеуге тыйым").click();
  await send.click();
  await expect(r).toContainText("1500 Б: ICMP қайтты, MTU 1400");
  await expect(r).toContainText("1400 Б: жетті");
  await expect(objective(page, "жіберуші пакетті кішірейтіп")).toHaveAttribute("data-done", "true");
  await nextStep(page);
  await expect(page.getByLabel("Брандмауэр ICMP-ді бұғаттайды")).toBeChecked();
  await send.click();
  await expect(r).toContainText("Нәтиже: жетпеді, 3000 мс күтті");
  await page.getByLabel("MSS clamping (туннель шетінде)").click();
  await send.click();
  await expect(r).toContainText("Нәтиже: жетті, 40 мс");
  await expect(objective(page, "MSS clamping қос")).toHaveAttribute("data-done", "true");
});
