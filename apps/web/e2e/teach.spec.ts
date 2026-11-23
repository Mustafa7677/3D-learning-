import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("Мустафаға түсіндір: a bare answer gets his questions, a full one with why and an example satisfies him", async ({ page }) => {
  await page.goto("/teach");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Мустафаға түсіндір");
  await page.getByRole("group", { name: "Зертхана" }).getByRole("button", { name: "Mathematics" }).click();
  await page.getByRole("button", { name: /Шеңбер және эллипс/ }).click();
  const chat = page.getByRole("region", { name: "Мустафаға түсіндіру: Шеңбер және эллипс" });
  await expect(chat).toContainText("Мен бұл туралы ештеңе білмеймін!");

  // Round 1: one short sentence.
  await page.getByLabel("Сенің түсіндірмең").fill("Эллипс бұл сопақ сызық.");
  await page.getByRole("button", { name: "Мустафаға айту" }).click();
  await expect(chat).toContainText("Неге солай?");
  await expect(chat).toContainText("Мысал келтірші?");
  await expect(chat).toContainText(/Ал «.+» деген не\?/);
  await expect(chat).toContainText("1/3 айналым");

  // Round 2: ideas, a cause, an example, short sentences.
  await page.getByLabel(/Толықтыр/).fill(
    "Эллипс деген сопақ қисық. Оның екі фокусы бар. Кез келген нүктеден фокустарға дейінгі қашықтықтар қосындысы тұрақты, ол 2a. Себебі бағбан оны бау мен екі қазықпен сызады, ал бау созылмайды. Мысалы, фокустарды бір жерге жинасаң, шеңбер шығады. Эксцентриситет оның қаншалық созылғанын айтады.",
  );
  await page.getByRole("button", { name: "Мустафаға айту" }).click();
  await expect(chat).toContainText("Енді түсіндім!");
  await expect(chat).toContainText("Фейнман әдісі осы");
  await expect(chat.getByRole("button", { name: "Басқа тақырыпты түсіндіру" })).toBeVisible();

  await chat.getByRole("button", { name: "Басқа тақырыпты түсіндіру" }).click();
  await expect(page.getByRole("region", { name: "Түсіндірген тақырыптарым" })).toContainText("Шеңбер және эллипс");
  await expect(page.getByRole("region", { name: "Түсіндірген тақырыптарым" }).getByLabel("4 белгі төрттен")).toBeVisible();
});
