import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import manifest from "../src/app/manifest";
import { GET as teacherManifestHandler } from "../src/app/manifest-teacher.webmanifest/route";
import { GET as parentManifestHandler } from "../src/app/manifest-parent.webmanifest/route";
import { parentNoStore } from "../src/lib/parent-auth";
import { teacherNoStore } from "../src/lib/teacher-auth";

describe("EduLedger Progressive Web App (PWA) Engine", () => {
  describe("Web App Manifests", () => {
    it("provides a valid root manifest with standalone display, shortcuts and all required icons", () => {
      const data = manifest();
      expect(data.name).toBe("EduLedger - School & Parent Portal");
      expect(data.short_name).toBe("EduLedger");
      expect(data.display).toBe("standalone");
      expect(data.start_url).toBe("/");
      expect(data.scope).toBe("/");
      expect(data.background_color).toBe("#ffffff");
      expect(data.theme_color).toBe("#2563eb");

      // Verify required icons (192, 512, maskable)
      expect(data.icons).toBeDefined();
      expect(data.icons!.length).toBeGreaterThanOrEqual(4);
      expect(data.icons!.some((i) => i.sizes === "192x192")).toBe(true);
      expect(data.icons!.some((i) => i.sizes === "512x512")).toBe(true);
      expect(data.icons!.some((i) => i.purpose === "maskable")).toBe(true);

      // Verify portal shortcuts
      expect(data.shortcuts).toBeDefined();
      expect(data.shortcuts!.length).toBe(3);
      expect(data.shortcuts!.map((s) => s.url)).toContain("/teacher");
      expect(data.shortcuts!.map((s) => s.url)).toContain("/parent");
      expect(data.shortcuts!.map((s) => s.url)).toContain("/dashboard");
    });

    it("serves dedicated Teacher Portal web app manifest", async () => {
      const res = await teacherManifestHandler();
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/manifest+json");
      const data = await res.json();
      expect(data.name).toBe("EduLedger - Teacher Portal");
      expect(data.start_url).toBe("/teacher");
      expect(data.scope).toBe("/teacher");
      expect(data.display).toBe("standalone");
      expect(data.shortcuts.length).toBeGreaterThanOrEqual(4);
    });

    it("serves dedicated Parent Portal web app manifest", async () => {
      const res = await parentManifestHandler();
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/manifest+json");
      const data = await res.json();
      expect(data.name).toBe("EduLedger - Parent Portal");
      expect(data.start_url).toBe("/parent");
      expect(data.scope).toBe("/parent");
      expect(data.display).toBe("standalone");
      expect(data.shortcuts.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Service Worker & Security Policies", () => {
    it("contains offline fallback pre-caching and security route exclusions in service worker", () => {
      const swPath = path.join(process.cwd(), "public", "firebase-messaging-sw.js");
      expect(fs.existsSync(swPath)).toBe(true);
      const swContent = fs.readFileSync(swPath, "utf-8");

      // Verify pre-caching assets
      expect(swContent).toContain("/offline.html");
      expect(swContent).toContain("/offline");
      expect(swContent).toContain("/icons/icon-192.png");
      expect(swContent).toContain("/icons/icon-512.png");

      // Verify sensitive prefixes guard (NEVER CACHE sensitive student / portal data!)
      expect(swContent).toContain('"/api/"');
      expect(swContent).toContain('"/parent"');
      expect(swContent).toContain('"/teacher"');
      expect(swContent).toContain('"/dashboard"');
      expect(swContent).toContain('"/students"');
      expect(swContent).toContain('"/fees"');
      expect(swContent).toContain('"/attendance"');
      expect(swContent).toContain('"/marks"');

      // Verify cache invalidation
      expect(swContent).toContain("self.skipWaiting()");
      expect(swContent).toContain("self.clients.claim()");
      expect(swContent).toContain("caches.delete(name)");
    });

    it("verifies public/sw.js exists and delegates to firebase-messaging-sw.js", () => {
      const swPath = path.join(process.cwd(), "public", "sw.js");
      expect(fs.existsSync(swPath)).toBe(true);
      const swContent = fs.readFileSync(swPath, "utf-8");
      expect(swContent).toContain('importScripts("/firebase-messaging-sw.js")');
    });

    it("verifies offline fallback static HTML file exists and is privacy-safe", () => {
      const offlineHtmlPath = path.join(process.cwd(), "public", "offline.html");
      expect(fs.existsSync(offlineHtmlPath)).toBe(true);
      const content = fs.readFileSync(offlineHtmlPath, "utf-8");
      expect(content).toContain("You're Offline");
      expect(content).toContain("Privacy Protection");
    });

    it("strictly enforces private no-cache, no-store headers on teacher and parent APIs", () => {
      expect(parentNoStore["Cache-Control"]).toContain("no-store");
      expect(parentNoStore["Cache-Control"]).toContain("private");
      expect(parentNoStore["Cache-Control"]).toContain("must-revalidate");
      expect(parentNoStore["Pragma"]).toBe("no-cache");

      expect(teacherNoStore["Cache-Control"]).toContain("no-store");
      expect(teacherNoStore["Cache-Control"]).toContain("private");
      expect(teacherNoStore["Cache-Control"]).toContain("must-revalidate");
      expect(teacherNoStore["Pragma"]).toBe("no-cache");
    });
  });

  describe("Application Icons Availability", () => {
    it("confirms presence of standard icons in public/icons/", () => {
      const icon192 = path.join(process.cwd(), "public", "icons", "icon-192.png");
      const icon512 = path.join(process.cwd(), "public", "icons", "icon-512.png");
      const appleIcon = path.join(process.cwd(), "public", "icons", "apple-touch-icon.png");
      const iconSvg = path.join(process.cwd(), "public", "icons", "icon.svg");

      expect(fs.existsSync(icon192)).toBe(true);
      expect(fs.existsSync(icon512)).toBe(true);
      expect(fs.existsSync(appleIcon)).toBe(true);
      expect(fs.existsSync(iconSvg)).toBe(true);
    });
  });
});

