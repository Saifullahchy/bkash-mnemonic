import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageKitStorage } from "../../src/core/storage/imageKitStorage.js";

const storage = new ImageKitStorage({
  privateKey: "private_test",
  urlEndpoint: "https://ik.imagekit.io/demo/",
  folder: "/offer-finder/",
});
const URL_ = "https://ik.imagekit.io/demo/offer-finder/campaigns/1/banner-abc.png";
const PATH_ = "/offer-finder/campaigns/1/banner-abc.png";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const mockFetch = (...responses: Response[]) => {
  const mock = vi.fn<typeof fetch>();
  responses.forEach((r) => mock.mockResolvedValueOnce(r));
  vi.stubGlobal("fetch", mock);
  return mock;
};
afterEach(() => vi.unstubAllGlobals());

describe("ImageKitStorage", () => {
  it("uploads with the private key and returns the CDN URL", async () => {
    const mock = mockFetch(json({ fileId: "f1", filePath: PATH_ }));
    expect(await storage.save("campaigns/1/banner-abc.png", Buffer.from("img"), "image/png")).toBe(
      URL_,
    );

    const [url, init] = mock.mock.calls[0]!;
    expect(url).toBe("https://upload.imagekit.io/api/v1/files/upload");
    expect(init?.headers).toEqual({
      Authorization: `Basic ${Buffer.from("private_test:").toString("base64")}`,
    });
    const form = init?.body as FormData;
    expect(form.get("fileName")).toBe("banner-abc.png");
    expect(form.get("folder")).toBe("/offer-finder/campaigns/1");
    expect(form.get("useUniqueFileName")).toBe("false");
    expect(await (form.get("file") as Blob).text()).toBe("img");
  });

  it("deletes the file whose path matches exactly", async () => {
    const mock = mockFetch(
      json([
        { fileId: "other", filePath: "/elsewhere/banner-abc.png" },
        { fileId: "f1", filePath: PATH_ },
      ]),
      new Response(null, { status: 204 }),
    );
    await storage.delete(URL_);
    expect((mock.mock.calls[0]![0] as URL).searchParams.get("searchQuery")).toBe(
      'name = "banner-abc.png"',
    );
    expect(mock.mock.calls[1]![0]).toBe("https://api.imagekit.io/v1/files/f1");
    expect(mock.mock.calls[1]![1]?.method).toBe("DELETE");
  });

  it("never touches foreign URLs, other folders or files that are already gone", async () => {
    const mock = mockFetch(json([]));
    await storage.delete("http://localhost:4000/uploads/campaigns/1/banner.png");
    await storage.delete("https://ik.imagekit.io/demo/other-project/banner.png");
    expect(mock).not.toHaveBeenCalled();
    await storage.delete(URL_);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("reports a bad key and an outage as 502", async () => {
    mockFetch(json({ message: "Your account cannot be authenticated." }, 403));
    await expect(storage.save("a/b.png", Buffer.from("x"), "image/png")).rejects.toMatchObject({
      statusCode: 502,
      message: expect.stringContaining("IMAGEKIT_PRIVATE_KEY") as string,
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(storage.save("a/b.png", Buffer.from("x"), "image/png")).rejects.toMatchObject({
      statusCode: 502,
      code: "IMAGE_STORAGE_FAILED",
    });
  });
});
