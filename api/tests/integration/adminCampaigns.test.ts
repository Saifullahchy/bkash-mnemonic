import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { LocalDiskStorage } from "../../src/core/storage/localDiskStorage.js";
import { CampaignModel } from "../../src/modules/campaign/campaign.model.js";
import { adminCookie, createAdmin, fakePng } from "../helpers/admin.js";
import { createCampaign, daysFrom, NOW } from "../helpers/factories.js";
import { testApp } from "../helpers/testApp.js";

const uploadDir = mkdtempSync(path.join(tmpdir(), "offer-finder-uploads-"));
const storage = new LocalDiskStorage(uploadDir, "http://api.test/uploads");
const app = () => testApp({ storage });
const fileFor = (url: string) => path.join(uploadDir, url.replace("http://api.test/uploads/", ""));

let cookie = "";
beforeEach(async () => {
  await createAdmin();
  cookie = await adminCookie();
});
afterAll(() => rmSync(uploadDir, { recursive: true, force: true }));

const validBody = (overrides: Record<string, unknown> = {}) => ({
  name: "Foodi Food Fest",
  merchantName: "Foodi",
  offerTitle: "Offer on Favorite Food Orders!",
  description: "Get BDT 100 discount.",
  reward: { title: "Win an iPhone 17 Pro" },
  schedule: { startAt: daysFrom(NOW, 1).toISOString(), endAt: daysFrom(NOW, 10).toISOString() },
  ...overrides,
});

const create = (body = validBody()) =>
  app().post("/v1/admin/campaigns").set("Cookie", cookie).send(body);

const uploadBanner = (id: string, png = fakePng(686, 304)) =>
  app()
    .post(`/v1/admin/campaigns/${id}/media/banner`)
    .set("Cookie", cookie)
    .attach("file", png, { filename: "banner.png", contentType: "image/png" });

describe("creating campaigns", () => {
  it("creates a draft with a slug, auto validity label and publish checklist", async () => {
    const res = await create().expect(201);
    expect(res.body.data).toMatchObject({
      slug: "foodi-food-fest",
      status: "draft",
      lifecycle: "draft",
      isActive: true,
      schedule: { validityLabel: "Valid until 3 Dec" },
      reward: { title: "Win an iPhone 17 Pro", numberOfWinners: 1, rankingBasis: "opens" },
      settings: { countLinkOpens: true, antiAbuse: { maxLinksPerDevice: 3 } },
      publishReadiness: {
        basicInfo: true,
        reward: true,
        schedule: true,
        banner: false,
        logo: false,
        canPublish: false,
        missing: ["Offer banner"],
      },
    });
  });

  it("keeps slugs unique", async () => {
    await create().expect(201);
    const second = await create().expect(201);
    expect(second.body.data.slug).toBe("foodi-food-fest-2");
  });

  it.each([
    [
      "end before start",
      validBody({ schedule: { startAt: daysFrom(NOW, 5), endAt: daysFrom(NOW, 1) } }),
    ],
    ["missing reward title", validBody({ reward: {} })],
    ["unknown field", validBody({ stats: { opens: 999999 } })],
    ["empty name", validBody({ name: "  " })],
  ])("rejects %s (400)", async (_label, body) => {
    const res = await create(body).expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("roles", () => {
  it("lets support staff read but not change campaigns", async () => {
    await createAdmin({ email: "support@example.com", role: "support" });
    const support = await adminCookie("support@example.com");
    await app().get("/v1/admin/campaigns").set("Cookie", support).expect(200);
    const res = await app().post("/v1/admin/campaigns").set("Cookie", support).send(validBody());
    expect(res.status).toBe(403);
  });
});

describe("updating", () => {
  it("applies partial nested updates without wiping sibling fields", async () => {
    const { body } = await create().expect(201);
    const res = await app()
      .patch(`/v1/admin/campaigns/${body.data.id}`)
      .set("Cookie", cookie)
      .send({
        reward: { title: "Win a MacBook" },
        settings: { antiAbuse: { maxOpensPerSubnetPerHour: 15 } },
      })
      .expect(200);

    expect(res.body.data.reward).toMatchObject({
      title: "Win a MacBook",
      rankingBasis: "opens",
      numberOfWinners: 1,
    });
    expect(res.body.data.settings.antiAbuse).toEqual({
      maxLinksPerDevice: 3,
      maxOpensPerSubnetPerHour: 15,
      maxOpensPerLinkPer10Min: 50,
    });
  });

  it("validates dates against the stored values and keeps the auto label in sync", async () => {
    const { body } = await create().expect(201);
    const id = body.data.id as string;
    await app()
      .patch(`/v1/admin/campaigns/${id}`)
      .set("Cookie", cookie)
      .send({ schedule: { endAt: daysFrom(NOW, 0.5) } })
      .expect(400);

    const res = await app()
      .patch(`/v1/admin/campaigns/${id}`)
      .set("Cookie", cookie)
      .send({ schedule: { endAt: daysFrom(NOW, 20) } })
      .expect(200);
    expect(res.body.data.schedule.validityLabel).toBe("Valid until 13 Dec");
  });
});

describe("publishing lifecycle", () => {
  it("requires a banner, then publishes to the public site", async () => {
    const { body } = await create(
      validBody({ schedule: { startAt: daysFrom(NOW, -1), endAt: daysFrom(NOW, 5) } }),
    ).expect(201);
    const id = body.data.id as string;

    const blocked = await app()
      .post(`/v1/admin/campaigns/${id}/publish`)
      .set("Cookie", cookie)
      .expect(422);
    expect(blocked.body.error).toMatchObject({
      code: "CAMPAIGN_INCOMPLETE",
      details: { missing: ["Offer banner"] },
    });

    await uploadBanner(id).expect(200);
    const published = await app()
      .post(`/v1/admin/campaigns/${id}/publish`)
      .set("Cookie", cookie)
      .expect(200);
    expect(published.body.data).toMatchObject({ status: "published", lifecycle: "live" });

    const site = await testApp().get("/v1/campaigns").expect(200);
    expect(site.body.data.map((o: { id: string }) => o.id)).toContain(id);
  });

  it("hides a campaign from the site with the Active switch", async () => {
    const campaign = await createCampaign();
    await app()
      .patch(`/v1/admin/campaigns/${campaign.id}/active`)
      .set("Cookie", cookie)
      .send({ isActive: false })
      .expect(200);
    const site = await testApp().get("/v1/campaigns").expect(200);
    expect(site.body.data).toHaveLength(0);
  });

  it("refuses to unpublish or delete a campaign people already joined", async () => {
    const campaign = await createCampaign();
    await CampaignModel.updateOne({ _id: campaign._id }, { "stats.participants": 3 });
    const id = campaign.id;

    const unpublish = await app()
      .post(`/v1/admin/campaigns/${id}/unpublish`)
      .set("Cookie", cookie)
      .expect(409);
    expect(unpublish.body.error.code).toBe("CAMPAIGN_HAS_PARTICIPANTS");
    await app().delete(`/v1/admin/campaigns/${id}`).set("Cookie", cookie).expect(409);
  });

  it("deletes an unused draft and its uploaded files", async () => {
    const { body } = await create().expect(201);
    const id = body.data.id as string;
    const uploaded = await uploadBanner(id).expect(200);
    const file = fileFor(uploaded.body.data.media.bannerUrl as string);
    expect(existsSync(file)).toBe(true);

    await app().delete(`/v1/admin/campaigns/${id}`).set("Cookie", cookie).expect(204);
    expect(await CampaignModel.countDocuments()).toBe(0);
    expect(existsSync(file)).toBe(false);
  });
});

describe("listing", () => {
  it("returns tab counts, filters by status, searches and paginates", async () => {
    await createCampaign({ slug: "live-a", name: "Foodi Live" });
    await createCampaign({ slug: "live-b", name: "Pathao Live" });
    await createCampaign({ slug: "draft", name: "Pickaboo", status: "draft" });
    await createCampaign({
      slug: "ended",
      name: "Chaldal",
      startAt: daysFrom(NOW, -9),
      endAt: daysFrom(NOW, -1),
    });
    await createCampaign({
      slug: "soon",
      name: "Daraz",
      startAt: daysFrom(NOW, 2),
      endAt: daysFrom(NOW, 9),
    });

    const all = await app().get("/v1/admin/campaigns?limit=2").set("Cookie", cookie).expect(200);
    expect(all.body.meta).toEqual({
      total: 5,
      page: 1,
      limit: 2,
      counts: { all: 5, live: 2, scheduled: 1, draft: 1, ended: 1 },
    });
    expect(all.body.data).toHaveLength(2);

    const live = await app().get("/v1/admin/campaigns?status=live").set("Cookie", cookie);
    expect(live.body.data.map((c: { lifecycle: string }) => c.lifecycle)).toEqual(["live", "live"]);

    const search = await app().get("/v1/admin/campaigns?search=pathao").set("Cookie", cookie);
    expect(search.body.data.map((c: { slug: string }) => c.slug)).toEqual(["live-b"]);

    await CampaignModel.updateOne({ slug: "live-a" }, { isActive: false });
    const paused = await app().get("/v1/admin/campaigns?active=false").set("Cookie", cookie);
    expect(paused.body.data.map((c: { slug: string }) => c.slug)).toEqual(["live-a"]);

    await app().get("/v1/admin/campaigns?status=bogus").set("Cookie", cookie).expect(400);
  });
});

describe("media uploads", () => {
  it("stores a valid banner and replaces (deletes) the previous one", async () => {
    const { body } = await create().expect(201);
    const id = body.data.id as string;

    const first = await uploadBanner(id).expect(200);
    const firstUrl = first.body.data.media.bannerUrl as string;
    expect(firstUrl).toMatch(
      new RegExp(`^http://api.test/uploads/campaigns/${id}/banner-\\w{12}\\.png$`),
    );
    expect(existsSync(fileFor(firstUrl))).toBe(true);

    const second = await uploadBanner(id, fakePng(1029, 456)).expect(200);
    expect(existsSync(fileFor(second.body.data.media.bannerUrl as string))).toBe(true);
    expect(existsSync(fileFor(firstUrl))).toBe(false);
  });

  it("accepts a square merchant logo", async () => {
    const { body } = await create().expect(201);
    const res = await app()
      .post(`/v1/admin/campaigns/${body.data.id as string}/media/logo`)
      .set("Cookie", cookie)
      .attach("file", fakePng(100, 100), { filename: "logo.png", contentType: "image/png" })
      .expect(200);
    expect(res.body.data.publishReadiness.logo).toBe(true);
  });

  it("stores the reward banner and prize tile images separately and keeps them on edit", async () => {
    const { body } = await create().expect(201);
    const id = body.data.id as string;
    const upload = (kind: string, png: Buffer) =>
      app()
        .post(`/v1/admin/campaigns/${id}/media/${kind}`)
        .set("Cookie", cookie)
        .attach("file", png, { filename: "prize.png", contentType: "image/png" })
        .expect(200);

    const first = await upload("reward-banner", fakePng(104, 150));
    expect(first.body.data.reward).toMatchObject({
      imageUrl: expect.stringMatching(/\/reward-banner-\w{12}\.png$/) as string,
      tileImageUrl: null,
    });
    const second = await upload("prize-tile", fakePng(102, 102));
    const { imageUrl, tileImageUrl } = second.body.data.reward as Record<string, string>;
    expect(imageUrl).toBe(first.body.data.reward.imageUrl);
    expect(tileImageUrl).toMatch(/\/prize-tile-\w{12}\.png$/);
    expect(second.body.data.publishReadiness).toMatchObject({ rewardImage: true, prizeTile: true });

    const edited = await app()
      .patch(`/v1/admin/campaigns/${id}`)
      .set("Cookie", cookie)
      .send({ reward: { title: "Bata gift card" } })
      .expect(200);
    expect(edited.body.data.reward).toMatchObject({ imageUrl, tileImageUrl });

    // Replacing one deletes only its own file; deleting the draft removes the rest.
    const replaced = await upload("reward-banner", fakePng(150, 100));
    const newUrl = replaced.body.data.reward.imageUrl as string;
    expect(existsSync(fileFor(imageUrl!))).toBe(false);
    expect(existsSync(fileFor(tileImageUrl!))).toBe(true);
    await app().delete(`/v1/admin/campaigns/${id}`).set("Cookie", cookie).expect(204);
    expect(existsSync(fileFor(newUrl))).toBe(false);
    expect(existsSync(fileFor(tileImageUrl!))).toBe(false);
  });

  it.each([
    ["a text file pretending to be a PNG", Buffer.from("<script>alert(1)</script>"), 400],
    ["a square image as a banner", fakePng(600, 600), 400],
    ["a banner smaller than 343×152", fakePng(300, 133), 400],
    ["a file over 2MB", fakePng(686, 304, 2 * 1024 * 1024 + 1), 413],
  ])("rejects %s", async (_label, file, status) => {
    const { body } = await create().expect(201);
    const res = await uploadBanner(body.data.id as string, file);
    expect(res.status).toBe(status);
  });

  it("rejects a request without a file and an unknown media kind", async () => {
    const { body } = await create().expect(201);
    const id = body.data.id as string;
    await app().post(`/v1/admin/campaigns/${id}/media/banner`).set("Cookie", cookie).expect(400);
    await app()
      .post(`/v1/admin/campaigns/${id}/media/avatar`)
      .set("Cookie", cookie)
      .attach("file", fakePng(100, 100), "x.png")
      .expect(400);
  });
});
