import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  currentUser: vi.fn(),
  getWhatsAppConfiguration: vi.fn(),
  saveWhatsAppConfiguration: vi.fn(),
  disconnectWhatsAppConfiguration: vi.fn(),
  whatsappTemplates: vi.fn(),
  saveWhatsAppTemplate: vi.fn(),
  whatsappRecipients: vi.fn(),
  updateWhatsAppConsent: vi.fn(),
  whatsappDashboard: vi.fn(),
  prepareAndQueueWhatsAppMessage: vi.fn(),
  retryWhatsAppMessage: vi.fn(),
  previewWhatsAppAudience: vi.fn(),
  scheduledWhatsAppMessages: vi.fn(),
  cancelWhatsAppMessage: vi.fn(),
  rescheduleWhatsAppMessage: vi.fn(),
  whatsappOperationalDiagnostics: vi.fn(),
  processWhatsAppWebhookStatus: vi.fn(),
  enqueueWhatsAppFeeReminders: vi.fn(),
  processWhatsAppQueue: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ currentUser: boundary.currentUser }));
vi.mock("@/lib/db", () => ({
  getWhatsAppConfiguration: boundary.getWhatsAppConfiguration,
  saveWhatsAppConfiguration: boundary.saveWhatsAppConfiguration,
  disconnectWhatsAppConfiguration: boundary.disconnectWhatsAppConfiguration,
  whatsappTemplates: boundary.whatsappTemplates,
  saveWhatsAppTemplate: boundary.saveWhatsAppTemplate,
  whatsappRecipients: boundary.whatsappRecipients,
  updateWhatsAppConsent: boundary.updateWhatsAppConsent,
  whatsappDashboard: boundary.whatsappDashboard,
  prepareAndQueueWhatsAppMessage: boundary.prepareAndQueueWhatsAppMessage,
  retryWhatsAppMessage: boundary.retryWhatsAppMessage,
  previewWhatsAppAudience: boundary.previewWhatsAppAudience,
  scheduledWhatsAppMessages: boundary.scheduledWhatsAppMessages,
  cancelWhatsAppMessage: boundary.cancelWhatsAppMessage,
  rescheduleWhatsAppMessage: boundary.rescheduleWhatsAppMessage,
  whatsappOperationalDiagnostics: boundary.whatsappOperationalDiagnostics,
  processWhatsAppWebhookStatus: boundary.processWhatsAppWebhookStatus,
  enqueueWhatsAppFeeReminders: boundary.enqueueWhatsAppFeeReminders,
  processWhatsAppQueue: boundary.processWhatsAppQueue,
}));

import * as audienceRoute from "../src/app/api/whatsapp/audience/route";
import * as configurationRoute from "../src/app/api/whatsapp/configuration/route";
import * as consentRoute from "../src/app/api/whatsapp/consent/route";
import * as cronRoute from "../src/app/api/cron/whatsapp/route";
import * as diagnosticsRoute from "../src/app/api/whatsapp/diagnostics/route";
import * as messagesRoute from "../src/app/api/whatsapp/messages/route";
import * as scheduledRoute from "../src/app/api/whatsapp/scheduled/route";
import * as templatesRoute from "../src/app/api/whatsapp/templates/route";
import * as webhookRoute from "../src/app/api/whatsapp/webhook/route";

const admin = { id: "user-a", institutionId: "institution-a", role: "SCHOOL_ADMIN" };
const teacher = { id: "teacher-a", institutionId: "institution-a", role: "TEACHER" };
const jsonRequest = (url: string, method: string, body: unknown) => new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("A route test attempted a real provider request."); }));
  boundary.currentUser.mockResolvedValue(admin);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("protected WhatsApp routes", () => {
  it("rejects unauthenticated configuration access before the database boundary", async () => {
    boundary.currentUser.mockResolvedValue(undefined);
    const response = await configurationRoute.GET();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthenticated" });
    expect(boundary.getWhatsAppConfiguration).not.toHaveBeenCalled();
  });

  it("rejects unauthorized template and consent access without leaking data", async () => {
    boundary.currentUser.mockResolvedValue(teacher);
    const templateResponse = await templatesRoute.GET();
    const consentResponse = await consentRoute.GET();
    expect(templateResponse.status).toBe(403);
    expect(consentResponse.status).toBe(403);
    expect(JSON.stringify(await templateResponse.json())).not.toMatch(/token|phone|database/i);
    expect(boundary.whatsappTemplates).not.toHaveBeenCalled();
    expect(boundary.whatsappRecipients).not.toHaveBeenCalled();
  });

  it("always scopes configuration, templates, schedules, and diagnostics to the session institution", async () => {
    boundary.getWhatsAppConfiguration.mockResolvedValue({ enabled: false });
    boundary.whatsappTemplates.mockResolvedValue([]);
    boundary.scheduledWhatsAppMessages.mockResolvedValue([]);
    boundary.whatsappOperationalDiagnostics.mockResolvedValue({ metrics: {}, readiness: {} });
    await configurationRoute.GET();
    await templatesRoute.GET();
    await scheduledRoute.GET();
    await diagnosticsRoute.GET();
    expect(boundary.getWhatsAppConfiguration).toHaveBeenCalledWith("institution-a");
    expect(boundary.whatsappTemplates).toHaveBeenCalledWith("institution-a");
    expect(boundary.scheduledWhatsAppMessages).toHaveBeenCalledWith("institution-a");
    expect(boundary.whatsappOperationalDiagnostics).toHaveBeenCalledWith("institution-a");
  });

  it("requires sender ownership attestation and keeps save and disconnect tenant-scoped", async () => {
    const rejected=await configurationRoute.PUT(jsonRequest("http://local/api/whatsapp/configuration","PUT",{enabled:false,businessNumber:"+919111111111",ownerConfirmed:false,autoAbsence:false,autoFeeReceipt:false,autoFeeReminder:false,autoMarksheet:false}));
    expect(rejected.status).toBe(400);
    expect(boundary.saveWhatsAppConfiguration).not.toHaveBeenCalled();
    boundary.saveWhatsAppConfiguration.mockResolvedValue({enabled:false,businessNumber:"+919111111111"});
    const accepted=await configurationRoute.PUT(jsonRequest("http://local/api/whatsapp/configuration","PUT",{institutionId:"institution-b",enabled:false,businessNumber:"+919111111111",ownerConfirmed:true,autoAbsence:true,autoFeeReceipt:false,autoFeeReminder:false,autoMarksheet:false}));
    expect(accepted.status).toBe(200);
    expect(boundary.saveWhatsAppConfiguration).toHaveBeenCalledWith("institution-a","user-a",expect.objectContaining({businessNumber:"+919111111111",ownerConfirmed:true}));
    boundary.disconnectWhatsAppConfiguration.mockResolvedValue({enabled:false,businessNumber:""});
    expect((await configurationRoute.DELETE()).status).toBe(200);
    expect(boundary.disconnectWhatsAppConfiguration).toHaveBeenCalledWith("institution-a","user-a");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ignores a client institution field and keeps audience resolution server-authoritative", async () => {
    boundary.currentUser.mockResolvedValue(teacher);
    boundary.previewWhatsAppAudience.mockResolvedValue({ eligibleMessages: 1, recipients: [{ maskedPhone: "+91••••••210" }] });
    const response = await audienceRoute.POST(jsonRequest("http://local/api/whatsapp/audience", "POST", { institutionId: "institution-b", studentId: "student-a", messageType: "Attendance", templateName: "absence" }));
    expect(response.status).toBe(200);
    expect(boundary.previewWhatsAppAudience).toHaveBeenCalledWith("institution-a", "Attendance", "absence", { studentId: "student-a" });
    expect(JSON.stringify(await response.json())).not.toContain("institution-b");
  });

  it("rejects client-supplied recipients and parameters before queueing", async () => {
    const response = await messagesRoute.POST(jsonRequest("http://local/api/whatsapp/messages", "POST", { studentId: "student-a", messageType: "Notice", templateName: "notice", idempotencyKey: "request-123", recipientPhone: "+919999999999", parameters: ["private"] }));
    expect(response.status).toBe(400);
    expect(boundary.prepareAndQueueWhatsAppMessage).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("passes only session institution and user IDs to consent updates", async () => {
    boundary.updateWhatsAppConsent.mockResolvedValue(true);
    const response = await consentRoute.PUT(jsonRequest("http://local/api/whatsapp/consent", "PUT", { studentId: "student-a", institutionId: "institution-b", whatsappEnabled: false, whatsappAttendance: false, whatsappAcademics: false, whatsappFees: false, whatsappNotices: false, whatsappGeneral: false }));
    expect(response.status).toBe(200);
    expect(boundary.updateWhatsAppConsent).toHaveBeenCalledWith("institution-a", "user-a", "student-a", { whatsappEnabled: false, whatsappAttendance: false, whatsappAcademics: false, whatsappFees: false, whatsappNotices: false, whatsappGeneral: false });
  });

  it("scopes retry IDs to the authenticated institution", async () => {
    vi.stubEnv("WHATSAPP_DISPATCH_ENABLED", "1");
    boundary.retryWhatsAppMessage.mockRejectedValue(new Error("Only failed messages can be retried."));
    const id = "11111111-1111-4111-8111-111111111111";
    const response = await messagesRoute.PATCH(jsonRequest("http://local/api/whatsapp/messages", "PATCH", { id }));
    expect(response.status).toBe(409);
    expect(boundary.retryWhatsAppMessage).toHaveBeenCalledWith("institution-a", "user-a", id);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not expose arbitrary database errors from action routes", async () => {
    vi.stubEnv("WHATSAPP_DISPATCH_ENABLED", "1");
    boundary.prepareAndQueueWhatsAppMessage.mockRejectedValue(new Error("postgresql://user:password@host/live relation secret_table failed"));
    const response = await messagesRoute.POST(jsonRequest("http://local/api/whatsapp/messages", "POST", { studentId: "student-a", messageType: "Notice", templateName: "notice", idempotencyKey: "request-456" }));
    expect(response.status).toBe(409);
    const body = JSON.stringify(await response.json());
    expect(body).toBe(JSON.stringify({ error: "Could not queue WhatsApp message." }));
    expect(body).not.toMatch(/password|secret_table|postgresql/i);
  });

  it("redacts sensitive dashboard failures in logs and returns a generic response", async () => {
    boundary.whatsappDashboard.mockRejectedValue(new Error("postgresql://user:password@host/db Bearer synthetic-token +919999999999"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await messagesRoute.GET();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not load the WhatsApp workspace." });
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toMatch(/password|synthetic-token|9999999999/);
  });
});

describe("public webhook route", () => {
  it("rejects invalid challenge tokens", async () => {
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "expected-token");
    const response = await webhookRoute.GET(new Request("http://local/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge"));
    expect(response.status).toBe(403);
  });

  it("rejects forged, malformed, unrelated, and oversized posts before persistence", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "synthetic-secret");
    const forged = await webhookRoute.POST(new Request("http://local/api/whatsapp/webhook", { method: "POST", headers: { "x-hub-signature-256": "sha256=" + "0".repeat(64) }, body: "{}" }));
    expect(forged.status).toBe(401);
    const malformedRaw = "not-json";
    const signature = "sha256=" + createHmac("sha256", "synthetic-secret").update(malformedRaw).digest("hex");
    const malformed = await webhookRoute.POST(new Request("http://local/api/whatsapp/webhook", { method: "POST", headers: { "x-hub-signature-256": signature }, body: malformedRaw }));
    expect(malformed.status).toBe(400);
    const oversized = await webhookRoute.POST(new Request("http://local/api/whatsapp/webhook", { method: "POST", headers: { "content-length": "1000001" }, body: "{}" }));
    expect(oversized.status).toBe(413);
    expect(boundary.processWhatsAppWebhookStatus).not.toHaveBeenCalled();
  });

  it("passes only validated synthetic lifecycle fields to persistence", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "synthetic-secret");
    boundary.processWhatsAppWebhookStatus.mockResolvedValue({ duplicate: false, updated: 1 });
    const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { statuses: [{ id: "wamid.synthetic", status: "delivered", timestamp: "1792022400" }] } }] }] });
    const signature = "sha256=" + createHmac("sha256", "synthetic-secret").update(raw).digest("hex");
    const response = await webhookRoute.POST(new Request("http://local/api/whatsapp/webhook", { method: "POST", headers: { "x-hub-signature-256": signature }, body: raw }));
    expect(response.status).toBe(200);
    expect(boundary.processWhatsAppWebhookStatus).toHaveBeenCalledWith({ providerMessageId: "wamid.synthetic", status: "delivered", timestamp: new Date(1792022400 * 1000), errorCode: "", errorMessage: "" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns a retryable failure instead of acknowledging a transaction error", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "synthetic-secret");
    boundary.processWhatsAppWebhookStatus.mockRejectedValue(new Error("synthetic transaction failure"));
    const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { statuses: [{ id: "wamid.synthetic", status: "delivered", timestamp: "1792022400" }] } }] }] });
    const signature = "sha256=" + createHmac("sha256", "synthetic-secret").update(raw).digest("hex");
    const response = await webhookRoute.POST(new Request("http://local/api/whatsapp/webhook", { method: "POST", headers: { "x-hub-signature-256": signature }, body: raw }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Webhook persistence failed." });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("dispatch route", () => {
  it("blocks manual queue, retry, scheduling, and rescheduling before persistence while dispatch is off", async () => {
    vi.stubEnv("WHATSAPP_DISPATCH_ENABLED", "0");
    const id = "11111111-1111-4111-8111-111111111111";
    const future = new Date(Date.now() + 60_000).toISOString();
    expect((await messagesRoute.POST(jsonRequest("http://local/api/whatsapp/messages", "POST", { studentId: "student-a", messageType: "Notice", templateName: "notice", idempotencyKey: "request-off-1" }))).status).toBe(423);
    expect((await messagesRoute.PATCH(jsonRequest("http://local/api/whatsapp/messages", "PATCH", { id }))).status).toBe(423);
    expect((await scheduledRoute.POST(jsonRequest("http://local/api/whatsapp/scheduled", "POST", { studentId: "student-a", messageType: "Notice", templateName: "notice", idempotencyKey: "request-off-2", scheduledAt: future }))).status).toBe(423);
    expect((await scheduledRoute.PATCH(jsonRequest("http://local/api/whatsapp/scheduled", "PATCH", { id, action: "reschedule", scheduledAt: future }))).status).toBe(423);
    expect(boundary.prepareAndQueueWhatsAppMessage).not.toHaveBeenCalled();
    expect(boundary.retryWhatsAppMessage).not.toHaveBeenCalled();
    expect(boundary.rescheduleWhatsAppMessage).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("cannot be enabled by request fields and does no work while the server guard is off", async () => {
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    vi.stubEnv("WHATSAPP_DISPATCH_ENABLED", "0");
    const response = await cronRoute.GET(new Request("http://local/api/cron/whatsapp?WHATSAPP_DISPATCH_ENABLED=1", { headers: { authorization: "Bearer cron-test-secret" } }));
    expect(response.status).toBe(423);
    expect(boundary.enqueueWhatsAppFeeReminders).not.toHaveBeenCalled();
    expect(boundary.processWhatsAppQueue).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
