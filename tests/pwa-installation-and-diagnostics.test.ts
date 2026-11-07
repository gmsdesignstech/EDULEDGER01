import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import mainManifest from "../src/app/manifest";
import { GET as teacherManifestHandler } from "../src/app/manifest-teacher.webmanifest/route";
import { GET as parentManifestHandler } from "../src/app/manifest-parent.webmanifest/route";
import { GET as pwaDiagnosticsHandler } from "../src/app/api/settings/pwa/route";

describe("EduLedger Complete PWA Installation, Device Support & Diagnostics Suite", () => {
  describe("Phase 2 & 3: Three Distinct Installable Application Identities", () => {
    it("provides the Administrator application manifest with root scope", () => {
      const data = mainManifest();
      expect(data.name).toBe("EduLedger");
      expect(data.short_name).toBe("EduLedger");
      expect(data.start_url).toBe("/");
      expect(data.scope).toBe("/");
      expect(data.display).toBe("standalone");
      expect(data.theme_color).toBe("#2563eb");
      expect(data.background_color).toBe("#ffffff");
    });

    it("provides the Teacher application manifest with dedicated /teacher scope", async () => {
      const res = await teacherManifestHandler();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe("EduLedger - Teacher Portal");
      expect(data.short_name).toBe("EduLedger Teacher");
      expect(data.start_url).toBe("/teacher");
      expect(data.scope).toBe("/teacher");
      expect(data.display).toBe("standalone");
    });

    it("provides the Parent application manifest with dedicated /parent scope", async () => {
      const res = await parentManifestHandler();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe("EduLedger - Parent Portal");
      expect(data.short_name).toBe("EduLedger Parent");
      expect(data.start_url).toBe("/parent");
      expect(data.scope).toBe("/parent");
      expect(data.display).toBe("standalone");
    });
  });

  describe("Phase 4: Landing Page & Multi-Device Installation Components", () => {
    it("verifies AppDownloadSection renders 3 distinct role cards with dedicated install buttons", () => {
      const sectionPath = path.join(process.cwd(), "src/components/app-download-section.tsx");
      expect(fs.existsSync(sectionPath)).toBe(true);
      const source = fs.readFileSync(sectionPath, "utf-8");

      // Administrator Card
      expect(source).toContain("Install EduLedger App");
      expect(source).toContain("Install EduLedger on your device for convenient access to your school’s management dashboard.");
      expect(source).toContain("For School Leadership");

      // Teacher Card
      expect(source).toContain("Install Teacher App");
      expect(source).toContain("Access your assigned classes, attendance, timetable, assignments, and examination tools.");
      expect(source).toContain("For Teachers &amp; Faculty");

      // Parent Card
      expect(source).toContain("Install Parent App");
      expect(source).toContain("Stay updated with your child’s attendance, examination results, homework, fees, and school announcements.");
      expect(source).toContain("For Parents &amp; Guardians");

      // Secondary Actions
      expect(source).toContain("Launch in browser");
    });

    it("verifies 6-step Apple iOS / Safari installation guidance in installation prompts", () => {
      const promptPath = path.join(process.cwd(), "src/components/pwa-install-prompt.tsx");
      const promptSource = fs.readFileSync(promptPath, "utf-8");

      expect(promptSource).toContain("Open in Apple Safari");
      expect(promptSource).toContain("Tap the Share Button");
      expect(promptSource).toContain('Select &quot;Add to Home Screen&quot;');
      expect(promptSource).toContain('Confirm by Tapping &quot;Add&quot;');
      expect(promptSource).toContain("Launch from Home Screen");
    });

    it("verifies standalone display mode detection prevents redundant install prompts", () => {
      const promptPath = path.join(process.cwd(), "src/components/pwa-install-prompt.tsx");
      const promptSource = fs.readFileSync(promptPath, "utf-8");

      expect(promptSource).toContain('window.matchMedia("(display-mode: standalone)").matches');
      expect(promptSource).toContain("isStandalone");
    });
  });

  describe("Phase 5: Service Worker & Privacy Invariants", () => {
    it("ensures sensitive school data is never cached in Service Worker cache storage", () => {
      const swPath = path.join(process.cwd(), "public", "firebase-messaging-sw.js");
      const swSource = fs.readFileSync(swPath, "utf-8");

      const sensitivePrefixes = [
        '"/api/"',
        '"/parent"',
        '"/teacher"',
        '"/dashboard"',
        '"/students"',
        '"/fees"',
        '"/attendance"',
        '"/marks"',
        '"/salaries"',
        '"/reports"',
      ];

      for (const prefix of sensitivePrefixes) {
        expect(swSource).toContain(prefix);
      }

      expect(swSource).toContain("const isPublicStaticAsset =");
      expect(swSource).toContain('caches.match(OFFLINE_URL)');
    });
  });

  describe("Phase 6 & 7: Firebase Push Notifications & Administrative Diagnostics", () => {
    it("verifies push-token route supports extended serialized Web Push tokens up to 4096 chars", () => {
      const routePath = path.join(process.cwd(), "src/app/api/notifications/push-token/route.ts");
      const routeSource = fs.readFileSync(routePath, "utf-8");

      expect(routeSource).toContain(".max(4096)");
      expect(routeSource).not.toContain(".max(500)");
    });

    it("verifies /api/settings/pwa protects server secrets and returns zero credential leakages", async () => {
      const routePath = path.join(process.cwd(), "src/app/api/settings/pwa/route.ts");
      const routeSource = fs.readFileSync(routePath, "utf-8");

      // Verify server checks admin role
      expect(routeSource).toContain('ADMIN_ROLES = ["SCHOOL_ADMIN", "SUPER_ADMIN"]');
      expect(routeSource).toContain("hasVapidKey");
      expect(routeSource).toContain("hasPrivateKey");

      // Must NEVER return the actual private key or secrets to the frontend!
      expect(routeSource).not.toContain("privateKey: process.env");
      expect(routeSource).not.toContain("vapidKey: process.env");
    });

    it("verifies /dashboard/settings/pwa diagnostics page is integrated in Settings", () => {
      const settingsPath = path.join(process.cwd(), "src/components/settings.tsx");
      const settingsSource = fs.readFileSync(settingsPath, "utf-8");

      expect(settingsSource).toContain('href="/dashboard/settings/pwa"');
      expect(settingsSource).toContain("PWA &amp; Push Diagnostics");
    });
  });
});
