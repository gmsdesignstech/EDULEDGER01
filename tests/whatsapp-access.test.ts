import{describe,expect,it}from"vitest";import{hasWhatsAppPermission,permissionForMessageType}from"../src/lib/whatsapp-access";
describe("WhatsApp least-privilege authorization",()=>{
 it("keeps provider configuration admin-only",()=>{expect(hasWhatsAppPermission("SCHOOL_ADMIN","configuration:manage")).toBe(true);expect(hasWhatsAppPermission("TEACHER","configuration:manage")).toBe(false);expect(hasWhatsAppPermission("ACCOUNTANT","configuration:manage")).toBe(false)});
 it("limits sensitive categories by role",()=>{expect(hasWhatsAppPermission("TEACHER",permissionForMessageType("Fee Reminder"))).toBe(false);expect(hasWhatsAppPermission("ACCOUNTANT",permissionForMessageType("Fee Reminder"))).toBe(true);expect(hasWhatsAppPermission("ACCOUNTANT",permissionForMessageType("Mark Sheet"))).toBe(false)});
 it("denies ungranted roles by default",()=>expect(hasWhatsAppPermission("STAFF","messages:send")).toBe(false));
});
