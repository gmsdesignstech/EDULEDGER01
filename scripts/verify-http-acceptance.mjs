// Repeatable HTTP verification script for EduLedger acceptance testing
import http from "node:http";

const BASE_URL = process.env.TEST_HTTP_BASE || "http://127.0.0.1:3001";

function fetchBuffer(urlStr) {
  return new Promise((resolve, reject) => {
    http.get(urlStr, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        });
      });
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function runAcceptance() {
  console.log(`Starting HTTP Acceptance Verification against: ${BASE_URL}\n`);
  const results = [];

  // 1. Icon URLs verification
  const icons = [
    { url: "/icons/apple-touch-icon.png", expectedW: 180, expectedH: 180 },
    { url: "/icons/icon-192.png", expectedW: 192, expectedH: 192 },
    { url: "/icons/icon-512.png", expectedW: 512, expectedH: 512 },
    { url: "/icons/icon-maskable-192.png", expectedW: 192, expectedH: 192 },
    { url: "/icons/icon-maskable-512.png", expectedW: 512, expectedH: 512 },
  ];

  for (const icon of icons) {
    const fullUrl = `${BASE_URL}${icon.url}`;
    const res = await fetchBuffer(fullUrl);
    const hex = res.body.subarray(0, 8).toString("hex");
    const isPNG = hex === "89504e470d0a1a0a";
    const isJPEG = res.body.subarray(0, 3).toString("hex") === "ffd8ff";
    const contentType = res.headers["content-type"] || "";
    const isImagePng = contentType.includes("image/png");

    let width = 0;
    let height = 0;
    if (isPNG && res.body.length >= 24) {
      width = res.body.readUInt32BE(16);
      height = res.body.readUInt32BE(20);
    }

    const passed =
      res.status === 200 &&
      isPNG &&
      !isJPEG &&
      isImagePng &&
      width === icon.expectedW &&
      height === icon.expectedH;

    results.push({
      item: `Icon: ${icon.url}`,
      status: res.status,
      contentType,
      length: res.body.length,
      format: isPNG ? "Valid PNG" : isJPEG ? "JPEG!" : "Unknown",
      dimensions: `${width}x${height}`,
      passed,
    });
  }

  // 2. Student Login verification
  {
    const fullUrl = `${BASE_URL}/student/login`;
    const res = await fetchBuffer(fullUrl);
    const html = res.body.toString("utf-8");
    const hasStudentSignIn = html.includes("Student Sign In") || html.includes("student") || html.includes("Student");
    const passed = res.status === 200 && hasStudentSignIn;

    results.push({
      item: "Route: /student/login",
      status: res.status,
      contentType: res.headers["content-type"],
      length: res.body.length,
      format: "HTML Document",
      dimensions: "N/A",
      passed,
    });
  }

  // 3. Student Manifest verification
  {
    const fullUrl = `${BASE_URL}/manifest-student.webmanifest`;
    const res = await fetchBuffer(fullUrl);
    const contentType = res.headers["content-type"] || "";
    let parsed = null;
    try {
      parsed = JSON.parse(res.body.toString("utf-8"));
    } catch {
      // ignore
    }

    const validManifest =
      parsed &&
      parsed.start_url === "/student" &&
      parsed.scope === "/student" &&
      Array.isArray(parsed.icons) &&
      parsed.icons.length === 4;

    const passed = res.status === 200 && contentType.includes("manifest") && validManifest;

    results.push({
      item: "Manifest: /manifest-student.webmanifest",
      status: res.status,
      contentType,
      length: res.body.length,
      format: validManifest ? "Valid JSON Manifest" : "Invalid JSON",
      dimensions: parsed ? `${parsed.icons.length} icons` : "N/A",
      passed,
    });
  }

  // 4. Other key routes
  const otherRoutes = ["/", "/parent", "/teacher"];
  for (const r of otherRoutes) {
    const fullUrl = `${BASE_URL}${r}`;
    const res = await fetchBuffer(fullUrl);
    const passed = res.status === 200 || res.status === 307; // 307 redirect to login is expected for protected routes
    results.push({
      item: `Route: ${r}`,
      status: res.status,
      contentType: res.headers["content-type"],
      length: res.body.length,
      format: "Route Response",
      dimensions: "N/A",
      passed,
    });
  }

  console.table(results);

  const allPassed = results.every((r) => r.passed);
  if (!allPassed) {
    console.error("\n❌ Some HTTP verification checks failed!");
    process.exit(1);
  } else {
    console.log("\n✅ All HTTP verification checks passed successfully!");
  }
}

runAcceptance().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
