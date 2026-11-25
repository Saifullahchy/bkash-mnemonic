import { describe, beforeEach, expect, it } from "vitest";
import ExcelJS from "exceljs";
import type { MailMessage, Mailer } from "../../src/core/mail/mailer.js";
import { ActivityModel } from "../../src/modules/activity/activity.model.js";
import { ExportLogModel } from "../../src/modules/admin/exports/exportLog.model.js";
import { ReportScheduleModel } from "../../src/modules/admin/exports/reportSchedule.model.js";
import { createApp } from "../../src/app.js";
import { buildContainer } from "../../src/container.js";
import { fixedClock } from "../../src/core/utils/clock.js";
import supertest from "supertest";
import { linkFor, participant } from "../helpers/activity.js";
import { adminCookie, createAdmin } from "../helpers/admin.js";
import { createCampaign, createTerms, NOW } from "../helpers/factories.js";
import { testApp } from "../helpers/testApp.js";

let cookie = "";
beforeEach(async () => {
  await createAdmin();
  cookie = await adminCookie();
});

const saveTerms = (body: Record<string, unknown>, who = cookie) =>
  testApp().put("/v1/admin/content/terms").set("Cookie", who).send(body);

describe("Terms & Conditions editor", () => {
  it("creates version 1, then saves new versions with history", async () => {
    const v1 = await saveTerms({
      title: "Terms",
      summary: "Short",
      html: "<p>First</p>",
      baseVersion: null,
    }).expect(200);
    expect(v1.body.data).toMatchObject({
      version: 1,
      html: "<p>First</p>",
      history: [],
      updatedByName: "Admin User",
    });

    const v2 = await saveTerms({
      title: "Terms v2",
      summary: "Short",
      html: "<p>Second</p>",
      baseVersion: 1,
    }).expect(200);
    expect(v2.body.data.version).toBe(2);
    expect(v2.body.data.history.map((h: { version: number }) => h.version)).toEqual([1]);

    const site = await testApp().get("/v1/content/terms").expect(200);
    expect(site.body.data).toMatchObject({ title: "Terms v2", html: "<p>Second</p>", version: 2 });
    expect(await ActivityModel.countDocuments({ type: "terms_updated" })).toBe(2);
  });

  it("sanitises HTML: scripts, handlers and javascript: links are removed", async () => {
    const res = await saveTerms({
      title: "T",
      summary: "S",
      html: '<p onclick="steal()">Hi <script>alert(1)</script><a href="javascript:alert(1)">bad</a> <a href="https://bkash.com">ok</a></p><iframe src="x"></iframe>',
      baseVersion: null,
    }).expect(200);
    expect(res.body.data.html).toBe(
      '<p>Hi bad <a href="https://bkash.com" target="_blank" rel="noopener noreferrer nofollow">ok</a></p>',
    );
  });

  it("rejects empty content and summaries over 160 characters", async () => {
    await saveTerms({
      title: "T",
      summary: "S",
      html: "<p> </p><script>x</script>",
      baseVersion: null,
    }).expect(400);
    await saveTerms({
      title: "T",
      summary: "x".repeat(161),
      html: "<p>a</p>",
      baseVersion: null,
    }).expect(400);
  });

  it("refuses to overwrite a newer version (two admins editing)", async () => {
    await saveTerms({ title: "T", summary: "S", html: "<p>a</p>", baseVersion: null }).expect(200);
    await saveTerms({ title: "T", summary: "S", html: "<p>b</p>", baseVersion: 1 }).expect(200);
    const stale = await saveTerms({
      title: "T",
      summary: "S",
      html: "<p>c</p>",
      baseVersion: 1,
    }).expect(409);
    expect(stale.body.error.code).toBe("CONTENT_CONFLICT");
  });

  it("restores an old version as the current one, without creating a copy", async () => {
    await createTerms(); // legacy version 3 (sections)
    await saveTerms({ title: "New", summary: "S", html: "<p>new</p>", baseVersion: 3 }).expect(200);
    const res = await testApp()
      .post("/v1/admin/content/terms/restore")
      .set("Cookie", cookie)
      .send({ version: 3 })
      .expect(200);
    // Version 3 is current again (same number); version 4 moved into the history.
    expect(res.body.data).toMatchObject({
      version: 3,
      html: "<h3>1. Eligibility</h3><p>Open to all.</p>",
    });
    expect(res.body.data.history.map((h: { version: number }) => h.version)).toEqual([4]);

    // Switching back is another restore; still no new versions.
    const back = await testApp()
      .post("/v1/admin/content/terms/restore")
      .set("Cookie", cookie)
      .send({ version: 4 })
      .expect(200);
    expect(back.body.data).toMatchObject({ version: 4, html: "<p>new</p>" });
    expect(back.body.data.history.map((h: { version: number }) => h.version)).toEqual([3]);

    // A save after restoring v3 gets the next free number (5), not a duplicate 4.
    await testApp()
      .post("/v1/admin/content/terms/restore")
      .set("Cookie", cookie)
      .send({ version: 3 })
      .expect(200);
    const saved = await saveTerms({
      title: "Newer",
      summary: "S",
      html: "<p>newer</p>",
      baseVersion: 3,
    }).expect(200);
    expect(saved.body.data.version).toBe(5);
    expect(saved.body.data.history.map((h: { version: number }) => h.version)).toEqual([4, 3]);
  });

  it("is read-only for support staff", async () => {
    await createAdmin({ email: "support@example.com", role: "support" });
    const support = await adminCookie("support@example.com");
    await testApp().get("/v1/admin/content/terms").set("Cookie", support).expect(200);
    await saveTerms(
      { title: "T", summary: "S", html: "<p>a</p>", baseVersion: null },
      support,
    ).expect(403);
  });
});

/** Downloads an export as a Buffer and parses it with exceljs. */
async function downloadXlsx(path: string, who = cookie) {
  const res = await testApp()
    .get(path)
    .set("Cookie", who)
    .buffer(true)
    .parse((r, done) => {
      const chunks: Buffer[] = [];
      r.on("data", (c: Buffer) => chunks.push(c));
      r.on("end", () => done(null, Buffer.concat(chunks)));
    });
  return res;
}

async function readWorkbook(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return wb;
}

describe("Excel exports", () => {
  it("streams participants as .xlsx with a dated filename, and logs it", async () => {
    const campaign = await createCampaign({ slug: "foodi" });
    const a = await participant({ phone: "01711111111" });
    await linkFor(campaign._id, a._id, { shares: 3, opens: 9 });

    const res = await downloadXlsx("/v1/admin/exports/participants");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.headers["content-disposition"]).toContain('filename="participants_all_23-Nov.xlsx"');

    const ws = (await readWorkbook(res.body as Buffer)).getWorksheet("Participants")!;
    expect(ws.getRow(1).values).toEqual([
      undefined,
      "Phone number",
      "First login",
      "Last active",
      "Status",
      "Campaigns",
      "Shares",
      "Link opens",
    ]);
    expect(ws.getRow(2).getCell(1).value).toBe("01711111111");
    expect(ws.getRow(2).getCell(6).value).toBe(3);
    expect(ws.getRow(2).getCell(7).value).toBe(9);

    const log = await ExportLogModel.findOne().lean();
    expect(log).toMatchObject({
      type: "participants",
      rows: 1,
      adminName: "Admin User",
      source: "download",
    });
  });

  it("exports one leaderboard sheet per campaign, ranked", async () => {
    const campaign = await createCampaign({ slug: "foodi", name: "Foodi Fair" });
    const [a, b] = await Promise.all([
      participant({ phone: "01711111111" }),
      participant({ phone: "01722222222" }),
    ]);
    await linkFor(campaign._id, a._id, { opens: 5, shares: 1 });
    await linkFor(campaign._id, b._id, { opens: 20, shares: 4, suspicious: true });

    const res = await downloadXlsx(`/v1/admin/exports/leaderboard?campaignId=${campaign.id}`);
    const wb = await readWorkbook(res.body as Buffer);
    const ws = wb.worksheets[0]!;
    expect(ws.name).toBe("Merchant (live)");
    expect(
      [2, 3].map((r) => [ws.getRow(r).getCell(1).value, ws.getRow(r).getCell(2).value]),
    ).toEqual([
      [1, "01722222222"],
      [2, "01711111111"],
    ]);
    expect(ws.getRow(2).getCell(7).value).toBe("Yes");
  });

  it("neutralises spreadsheet formula injection in exported text", async () => {
    await createCampaign({ slug: "evil", name: '=HYPERLINK("http://evil","click")' });
    const res = await downloadXlsx("/v1/admin/exports/campaigns");
    const ws = (await readWorkbook(res.body as Buffer)).getWorksheet("Campaigns")!;
    expect(ws.getRow(2).getCell(1).value).toBe('\'=HYPERLINK("http://evil","click")');
  });

  it("re-downloads a past export from history and reports card counts", async () => {
    await participant();
    await downloadXlsx("/v1/admin/exports/participants");
    const history = await testApp()
      .get("/v1/admin/exports/history")
      .set("Cookie", cookie)
      .expect(200);
    expect(history.body.data[0]).toMatchObject({ type: "participants", rows: 1 });

    const again = await downloadXlsx(
      `/v1/admin/exports/history/${history.body.data[0].id as string}/download`,
    );
    expect(again.status).toBe(200);
    const summary = await testApp()
      .get("/v1/admin/exports/summary")
      .set("Cookie", cookie)
      .expect(200);
    expect(summary.body.data).toMatchObject({ participants: 1 });
  });

  it("custom export: several datasets in one workbook, chosen participant columns", async () => {
    const campaign = await createCampaign({ slug: "foodi" });
    const a = await participant({ phone: "01711111111" });
    await linkFor(campaign._id, a._id, { shares: 3, opens: 9 });

    const res = await downloadXlsx(
      "/v1/admin/exports/custom?datasets=participants,campaigns&columns=phone,shares,opens",
    );
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain(
      'filename="custom_export_all_23-Nov.xlsx"',
    );
    const wb = await readWorkbook(res.body as Buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Participants", "Campaigns"]);
    const ws = wb.getWorksheet("Participants")!;
    expect(ws.getRow(1).values).toEqual([undefined, "Phone number", "Shares", "Link opens"]);
    expect(ws.getRow(2).values).toEqual([undefined, "01711111111", 3, 9]);

    // Logged with every dataset and the column pick, and re-downloadable as-is.
    const history = await testApp()
      .get("/v1/admin/exports/history")
      .set("Cookie", cookie)
      .expect(200);
    expect(history.body.data[0]).toMatchObject({ datasets: ["participants", "campaigns"] });
    const again = await downloadXlsx(
      `/v1/admin/exports/history/${history.body.data[0].id as string}/download`,
    );
    const wb2 = await readWorkbook(again.body as Buffer);
    expect(wb2.worksheets).toHaveLength(2);
    expect(wb2.getWorksheet("Participants")!.getRow(1).values).toEqual([
      undefined,
      "Phone number",
      "Shares",
      "Link opens",
    ]);

    await testApp()
      .get("/v1/admin/exports/custom?datasets=participants,passwords")
      .set("Cookie", cookie)
      .expect(400);
    await testApp().get("/v1/admin/exports/custom?datasets=").set("Cookie", cookie).expect(400);
  });

  it("keeps personal-data exports admin-only and validates the type", async () => {
    await createAdmin({ email: "support@example.com", role: "support" });
    const support = await adminCookie("support@example.com");
    await testApp().get("/v1/admin/exports/participants").set("Cookie", support).expect(403);
    await testApp().get("/v1/admin/exports/passwords").set("Cookie", cookie).expect(400);
  });
});

describe("Scheduled report", () => {
  const sent: MailMessage[] = [];
  const mailer: Mailer = { send: (m) => Promise.resolve(void sent.push(m)) };
  const appAt = (now: Date) =>
    supertest(
      createApp(buildContainer({ clock: fixedClock(now), rateLimitEnabled: false, mailer })),
    );

  beforeEach(() => {
    sent.length = 0;
  });

  it("saves the schedule with the next Monday 09:00 Dhaka run", async () => {
    // NOW = Monday 23 Nov 2026, 12:00 Dhaka → next run Monday 30 Nov 09:00 Dhaka (03:00 UTC).
    const res = await appAt(NOW)
      .put("/v1/admin/exports/schedule")
      .set("Cookie", cookie)
      .send({
        enabled: true,
        frequency: "weekly",
        datasets: ["participants", "leaderboard"],
        recipients: ["ops@example.com"],
      })
      .expect(200);
    expect(res.body.data).toMatchObject({
      enabled: true,
      nextRunAt: "2026-11-30T03:00:00.000Z",
      delivery: "outbox",
    });
  });

  it("requires recipients when enabled", async () => {
    await appAt(NOW)
      .put("/v1/admin/exports/schedule")
      .set("Cookie", cookie)
      .send({ enabled: true, frequency: "daily", datasets: ["participants"], recipients: [] })
      .expect(400);
  });

  it("sends the due report exactly once with the chosen attachments", async () => {
    await participant();
    await appAt(NOW)
      .put("/v1/admin/exports/schedule")
      .set("Cookie", cookie)
      .send({
        enabled: true,
        frequency: "daily",
        datasets: ["participants", "leaderboard"],
        recipients: ["ops@example.com"],
      })
      .expect(200);

    const container = buildContainer({
      clock: fixedClock(new Date("2026-11-24T03:01:00Z")),
      mailer,
    });
    const [first, second] = await Promise.all([
      container.services.reports.runDue(),
      container.services.reports.runDue(),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: ["ops@example.com"] });
    expect(sent[0]!.attachments!.map((a) => a.filename)).toEqual([
      "participants_all_24-Nov.xlsx",
      "leaderboard_all_24-Nov.xlsx",
    ]);

    const schedule = await ReportScheduleModel.findOne().lean();
    expect(schedule).toMatchObject({
      lastStatus: "sent",
      nextRunAt: new Date("2026-11-25T03:00:00Z"),
    });
    expect(await ExportLogModel.countDocuments({ source: "scheduled" })).toBe(2);
  });
});
