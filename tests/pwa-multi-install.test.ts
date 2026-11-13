import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { TEACHER_MANIFEST, PARENT_MANIFEST } from "@/lib/pwa-manifests";
import { GET as getTeacherManifest } from "@/app/teacher/manifest.webmanifest/route";
import { GET as getParentManifest } from "@/app/parent/manifest.webmanifest/route";
import { GET as getLegacyTeacherManifest } from "@/app/manifest-teacher.webmanifest/route";
import { GET as getLegacyParentManifest } from "@/app/manifest-parent.webmanifest/route";
import { GET as getTeacherSw } from "@/app/teacher/sw.js/route";
import { GET as getParentSw } from "@/app/parent/sw.js/route";

describe("EduLedger Multi-PWA Architecture", () => {
  describe("1. Teacher Manifest Verification", () => {
    it("should have correct application identity and scope", () => {
      expect(TEACHER_MANIFEST.name).toBe("EduLedger Teacher");
      expect(TEACHER_MANIFEST.short_name).toBe("Teacher");
      expect(TEACHER_MANIFEST.start_url).toBe("/teacher");
      expect(TEACHER_MANIFEST.scope).toBe("/teacher/");
      expect(TEACHER_MANIFEST.display).toBe("standalone");
      expect(TEACHER_MANIFEST.theme_color).toBe("#4f46e5");
      expect(TEACHER_MANIFEST.background_color).toBe("#0f172a");
    });

    it("should include all required icon dimensions and formats", () => {
      const iconSizes = TEACHER_MANIFEST.icons.map((i) => i.sizes);
      expect(iconSizes).toContain("192x192");
      expect(iconSizes).toContain("512x512");
      expect(iconSizes).toContain("any");

      const maskable = TEACHER_MANIFEST.icons.filter((i) => i.purpose === "maskable");
      expect(maskable.length).toBeGreaterThanOrEqual(2);
    });

    it("should return valid JSON with proper headers from route handler", async () => {
      const res = await getTeacherManifest();
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/manifest+json");
      const data = await res.json();
      expect(data.name).toBe("EduLedger Teacher");
      expect(data.scope).toBe("/teacher/");
    });

    it("legacy route handler should remain accessible for backward compatibility", async () => {
      const res = await getLegacyTeacherManifest();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.start_url).toBe("/teacher");
      expect(data.scope).toBe("/teacher");
    });
  });

  describe("2. Parent Manifest Verification", () => {
    it("should have correct application identity and scope", () => {
      expect(PARENT_MANIFEST.name).toBe("EduLedger Parent");
      expect(PARENT_MANIFEST.short_name).toBe("Parent");
      expect(PARENT_MANIFEST.start_url).toBe("/parent");
      expect(PARENT_MANIFEST.scope).toBe("/parent/");
      expect(PARENT_MANIFEST.display).toBe("standalone");
      expect(PARENT_MANIFEST.theme_color).toBe("#1d4ed8");
      expect(PARENT_MANIFEST.background_color).toBe("#0f172a");
    });

    it("should include all required icon dimensions and formats", () => {
      const iconSizes = PARENT_MANIFEST.icons.map((i) => i.sizes);
      expect(iconSizes).toContain("192x192");
      expect(iconSizes).toContain("512x512");
      expect(iconSizes).toContain("any");

      const maskable = PARENT_MANIFEST.icons.filter((i) => i.purpose === "maskable");
      expect(maskable.length).toBeGreaterThanOrEqual(2);
    });

    it("should return valid JSON with proper headers from route handler", async () => {
      const res = await getParentManifest();
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/manifest+json");
      const data = await res.json();
      expect(data.name).toBe("EduLedger Parent");
      expect(data.scope).toBe("/parent/");
    });

    it("legacy route handler should remain accessible for backward compatibility", async () => {
      const res = await getLegacyParentManifest();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.start_url).toBe("/parent");
      expect(data.scope).toBe("/parent");
    });
  });

  describe("3. Scoped Service Workers & Security Isolation", () => {
    it("should serve /teacher/sw.js with correct scope headers", async () => {
      const res = await getTeacherSw();
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/javascript");
      expect(res.headers.get("Service-Worker-Allowed")).toBe("/teacher/");
      expect(res.headers.get("Cache-Control")).toBe("no-cache, no-store, must-revalidate");

      const text = await res.text();
      expect(text).toContain("eduledger-teacher-v1");
      expect(text).toContain("url.pathname.startsWith('/api/')");
      expect(text).toContain("caches.match('/offline')");
    });

    it("should serve /parent/sw.js with correct scope headers", async () => {
      const res = await getParentSw();
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/javascript");
      expect(res.headers.get("Service-Worker-Allowed")).toBe("/parent/");
      expect(res.headers.get("Cache-Control")).toBe("no-cache, no-store, must-revalidate");

      const text = await res.text();
      expect(text).toContain("eduledger-parent-v1");
      expect(text).toContain("url.pathname.startsWith('/api/')");
      expect(text).toContain("caches.match('/offline')");
    });

    it("service workers must enforce strict privacy bypass for /api/ and auth", async () => {
      const teacherRes = await getTeacherSw();
      const teacherCode = await teacherRes.text();
      expect(teacherCode).toMatch(/if\s*\(\s*url\.pathname\.startsWith\(['"]\/api\/['"]\)/);
      expect(teacherCode).toMatch(/url\.pathname\.includes\(['"]token['"]\)/);

      const parentRes = await getParentSw();
      const parentCode = await parentRes.text();
      expect(parentCode).toMatch(/if\s*\(\s*url\.pathname\.startsWith\(['"]\/api\/['"]\)/);
      expect(parentCode).toMatch(/url\.pathname\.includes\(['"]token['"]\)/);
    });
  });

  describe("4. Authentic Image Signatures & Asset Verification", () => {
    const icons = [
      "public/icons/teacher/icon-192.png",
      "public/icons/teacher/icon-512.png",
      "public/icons/teacher/icon-maskable-192.png",
      "public/icons/teacher/icon-maskable-512.png",
      "public/icons/teacher/apple-touch-icon.png",
      "public/icons/parent/icon-192.png",
      "public/icons/parent/icon-512.png",
      "public/icons/parent/icon-maskable-192.png",
      "public/icons/parent/icon-maskable-512.png",
      "public/icons/parent/apple-touch-icon.png",
    ];

    for (const iconPath of icons) {
      it(`should have valid PNG header for ${iconPath}`, () => {
        const fullPath = path.join(process.cwd(), iconPath);
        expect(fs.existsSync(fullPath)).toBe(true);
        const buf = fs.readFileSync(fullPath);
        expect(buf.length).toBeGreaterThan(1000);
        // Verify PNG magic bytes
        expect(buf[0]).toBe(0x89);
        expect(buf[1]).toBe(0x50);
        expect(buf[2]).toBe(0x4e);
        expect(buf[3]).toBe(0x47);
        expect(buf[4]).toBe(0x0d);
        expect(buf[5]).toBe(0x0a);
        expect(buf[6]).toBe(0x1a);
        expect(buf[7]).toBe(0x0a);
      });
    }

    it("should have SVG sources for scalable rendering", () => {
      expect(fs.existsSync(path.join(process.cwd(), "public/icons/teacher/icon.svg"))).toBe(true);
      expect(fs.existsSync(path.join(process.cwd(), "public/icons/parent/icon.svg"))).toBe(true);
    });
  });

  describe("5. Administrator Manifest & Safety Preservation", () => {
    it("root manifest should remain dedicated to EduLedger Admin with root scope", async () => {
      const manifestPath = path.join(process.cwd(), "src/app/manifest.ts");
      expect(fs.existsSync(manifestPath)).toBe(true);
      const content = fs.readFileSync(manifestPath, "utf-8");
      expect(content).toContain('name: "EduLedger"');
      expect(content).toContain('start_url: "/"');
      expect(content).toContain('scope: "/"');
    });
  });
});
