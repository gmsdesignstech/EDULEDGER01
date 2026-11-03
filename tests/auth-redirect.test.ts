import { describe, expect, it } from "vitest";
import { annualCheckoutHref, roleHome, safeSchoolRedirect, schoolAccountDestination, schoolEnrollmentHref, whatsappAddonCheckoutHref } from "../src/lib/auth-redirect";

describe("school authentication return destinations", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard/students?add=1", "/dashboard/students?add=1"],
    ["/subscription?students=77", "/subscription?students=77"],
    ["/whatsapp/subscribe?students=77", "/whatsapp/subscribe?students=77"],
    ["/register?students=77&addon=whatsapp", "/register?students=77&addon=whatsapp"],
  ])("allows an authorized in-app destination", (value, expected) => {
    expect(safeSchoolRedirect(value)).toBe(expected);
  });

  it.each([undefined, "", "https://evil.test", "//evil.test", "/admin", "/api/admin", "/dashboard\\evil"])(
    "rejects an unsafe or non-school destination: %s",
    (value) => expect(safeSchoolRedirect(value)).toBe("/dashboard"),
  );

  it.each([
    [1, "/whatsapp/subscribe?students=1"],
    [77, "/whatsapp/subscribe?students=77"],
    [100_000, "/whatsapp/subscribe?students=100000"],
    [0, "/whatsapp/subscribe?students=1"],
    [100_001, "/whatsapp/subscribe?students=1"],
    [1.5, "/whatsapp/subscribe?students=1"],
  ])("keeps the WhatsApp landing CTA separate from core registration", (count, expected) => {
    expect(whatsappAddonCheckoutHref(count)).toBe(expected);
    expect(whatsappAddonCheckoutHref(count)).not.toContain("/register");
    expect(whatsappAddonCheckoutHref(count)).not.toContain("/subscription?");
  });

  it.each([
    [1, "/subscription?students=1"],
    [77, "/subscription?students=77"],
    [100_000, "/subscription?students=100000"],
    [0, "/subscription?students=1"],
  ])("sends successful registration to annual checkout without an add-on continuation", (count, expected) => {
    expect(annualCheckoutHref(count)).toBe(expected);
    expect(annualCheckoutHref(count)).not.toContain("next=");
    expect(annualCheckoutHref(count)).not.toContain("/whatsapp/subscribe");
  });

  it.each([
    [1, "/register?students=1"],
    [50, "/register?students=50"],
    [100, "/register?students=100"],
    [101, "/register?students=101"],
    [150, "/register?students=150"],
  ])("starts annual enrollment from the landing calculator", (count, expected) => {
    expect(schoolEnrollmentHref(count)).toBe(expected);
    expect(schoolEnrollmentHref(count)).not.toContain("/whatsapp/subscribe");
  });
});

describe("school account workflow destination", () => {
  it("resumes unpaid, pending, and active administrators at the correct step", () => {
    expect(schoolAccountDestination({role:"SCHOOL_ADMIN",subscriptionStatus:"UNPAID"})).toBe("/subscription");
    expect(schoolAccountDestination({role:"SCHOOL_ADMIN",subscriptionStatus:"PENDING",paymentStatus:"Pending",orderId:"order_123"})).toContain("/payment/success?product=subscription&order=order_123");
    expect(schoolAccountDestination({role:"SCHOOL_ADMIN",subscriptionStatus:"ACTIVE",requested:"/dashboard/students"})).toBe("/dashboard/students");
    expect(schoolAccountDestination({role:"SUPER_ADMIN",subscriptionStatus:"UNPAID"})).toBe("/admin");
    expect(schoolAccountDestination({role:"TEACHER",subscriptionStatus:"UNPAID"})).toBe("/teacher");
    expect(schoolAccountDestination({role:"PARENT",subscriptionStatus:"UNPAID"})).toBe("/parent");
  });
});

describe("role portal destinations", () => {
  it.each([
    ["SUPER_ADMIN", "/admin"],
    ["SCHOOL_ADMIN", "/dashboard"],
    ["TEACHER", "/teacher"],
    ["PARENT", "/parent"],
    ["ACCOUNTANT", "/dashboard"],
  ])("routes %s to %s", (role, destination) => {
    expect(roleHome(role)).toBe(destination);
  });
});
