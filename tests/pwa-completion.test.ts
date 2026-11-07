import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import mainManifest from "../src/app/manifest";
import { GET as parentManifest } from "../src/app/manifest-parent.webmanifest/route";
import { GET as teacherManifest } from "../src/app/manifest-teacher.webmanifest/route";
import { GET as studentManifest } from "../src/app/manifest-student.webmanifest/route";

const root = process.cwd();
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function assertPngIcon(src: string, expectedSize: number) {
  const file = path.join(root, "public", src.replace(/^\//, ""));
  expect(existsSync(file)).toBe(true);
  const image = readFileSync(file);
  expect(image.subarray(0, 8)).toEqual(pngSignature);
  expect(image.toString("ascii", 12, 16)).toBe("IHDR");
  expect(image.readUInt32BE(16)).toBe(expectedSize);
  expect(image.readUInt32BE(20)).toBe(expectedSize);
}

describe("EduLedger PWA assets and manifests", () => {
  it("declares the primary EduLedger app and valid raster icon sizes", () => {
    expect(mainManifest()).toMatchObject({
      name: "EduLedger",
      short_name: "EduLedger",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "any",
    });
    assertPngIcon("/icons/icon-192.png", 192);
    assertPngIcon("/icons/icon-512.png", 512);
    assertPngIcon("/icons/icon-maskable-192.png", 192);
    assertPngIcon("/icons/icon-maskable-512.png", 512);
    assertPngIcon("/icons/apple-touch-icon.png", 180);
  });

  it.each([
    ["Parent", parentManifest, "/parent", "/parent"],
    ["Teacher", teacherManifest, "/teacher", "/teacher"],
    ["Student", studentManifest, "/student", "/student"],
  ])("keeps the %s app manifest scoped and installable", async (_name, handler, startUrl, scope) => {
    const response = await handler();
    expect(response.headers.get("Content-Type")).toContain("application/manifest+json");
    const manifest = await response.json();
    expect(manifest).toMatchObject({
      start_url: startUrl,
      scope,
      display: "standalone",
      orientation: "any",
    });
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }),
      expect.objectContaining({ src: "/icons/icon-maskable-192.png", purpose: "maskable" }),
      expect.objectContaining({ src: "/icons/icon-maskable-512.png", purpose: "maskable" }),
    ]));
  });

  it("registers one root worker and caches only safe static paths", () => {
    const pushManager = readFileSync(path.join(root, "src/components/notification-push-manager.tsx"), "utf8");
    const worker = readFileSync(path.join(root, "public/firebase-messaging-sw.js"), "utf8");
    expect(pushManager).toContain('.register("/sw.js", { scope: "/" })');
    expect(worker).toContain('const CACHE_NAME = "eduledger-pwa-v5"');
    expect(worker).toContain('url.pathname.startsWith("/_next/static/")');
    expect(worker).toContain('url.pathname.startsWith("/icons/")');
    expect(worker).toContain('url.pathname === "/eduledger-logo.jpeg"');
    expect(worker).not.toMatch(/url\.pathname\.endsWith\("\.(?:png|jpe?g|svg|woff2)"\)/);
    expect(worker).toContain('caches.delete(name)');
    expect(worker).toContain('fetch(request).catch(() => caches.match(OFFLINE_URL))');
  });

  it("keeps the offline message explicit that private actions are not queued", () => {
    const offline = readFileSync(path.join(root, "public/offline.html"), "utf8");
    expect(offline).toContain("Unsaved changes are not queued or submitted later.");
  });
});
