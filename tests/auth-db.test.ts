import { describe, expect, it } from "vitest";
import { compare, hash } from "bcryptjs";
import { createHmac } from "node:crypto";
import {
  activateVerifiedSubscription,
  activateVerifiedWhatsAppAddon,
  addStudent,
  createAccount,
  createPendingSubscription,
  createPendingWhatsAppAddon,
  createSession,
  deleteSession,
  failSubscription,
  findUserByEmail,
  getSubscription,
  getSubscriptionBillingStudentCount,
  getWhatsAppAddonSubscription,
  getCompleteSettings,
  getVerifiedPaymentConfirmation,
  getUserBySession,
  saveSubscriptionStudentCount,
  saveCompleteSettings,
} from "../src/lib/db";
import { verifyRazorpaySignature } from "../src/lib/payment";
import { STARTER_ANNUAL_PRICE, STARTER_PLAN_ID } from "../src/lib/subscription-plans";

describe("database auth flow", () => {
  it("creates a school admin account with SQLite bindings", async () => {
    const email = `sqlite-auth-${Date.now()}@example.com`;
    const passwordHash = await hash("password123", 12);
    const user = await createAccount({
      name: "SQLite Test User",
      email,
      institution: "Test Institution",
      passwordHash,
    });

    expect(user.email).toBe(email);
    expect(user.role).toBe("SCHOOL_ADMIN");
    expect(await findUserByEmail(email)).toMatchObject({ email });
    expect(await compare("password123", passwordHash)).toBe(true);
    expect(await compare("incorrect-password", passwordHash)).toBe(false);

    const session = await createSession(user.id);
    expect(await getUserBySession(session.token)).toMatchObject({ email });
    await deleteSession(session.token);
    expect(await getUserBySession(session.token)).toBeUndefined();

    const orderId = `order_test_${Date.now()}`;
    const paymentId = `pay_test_${Date.now()}`;
    const secret = "test-secret-used-only-by-the-automated-test";
    const signature = createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    expect(
      verifyRazorpaySignature(orderId, paymentId, signature, secret),
    ).toBe(true);
    expect(
      verifyRazorpaySignature(orderId, paymentId, "0".repeat(64), secret),
    ).toBe(false);

    await expect(createPendingSubscription(user.institutionId,"annual-service",orderId,0,0,100)).rejects.toThrow("positive whole number");
    expect(await getSubscription(user.institutionId)).toMatchObject({status:"UNPAID",studentUsage:0});

    await saveSubscriptionStudentCount(user.institutionId,user.id,10);
    const accountSettings=await getCompleteSettings(user.institutionId);
    await saveCompleteSettings(user.institutionId,user.id,{...accountSettings,schoolCode:"AUT",academicYear:"2026-2027",startMonth:4,endMonth:3,academicYears:[{name:"2026-2027",startMonth:4,endMonth:3,status:"Active"}],classes:[{name:"Class 1",sections:["A"]}]});
    await addStudent(user.institutionId,{name:"Auth Student",admission:`AUTH-${Date.now()}`,gender:"Other",dateOfBirth:"2015-01-01",className:"Class 1",section:"A",parent:"Parent",parentPhone:"9876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:0,academicYear:"2026-2027",dueDate:"2027-03-01"},user.id);
    const failedOrder=`order_failed_${Date.now()}`;
    await createPendingSubscription(user.institutionId,"annual-service",failedOrder,1,100,100);
    await failSubscription(failedOrder);
    expect(await getSubscription(user.institutionId)).toMatchObject({status:"FAILED",paymentStatus:"Failed",pricePerStudent:100,studentCapacity:1,amountPaid:100});

    const paidOrder=`order_paid_${Date.now()}`;
    await createPendingSubscription(user.institutionId,"annual-service",paidOrder,1,100,100);
    await activateVerifiedSubscription(paidOrder,paymentId,signature);
    const activated=await getSubscription(user.institutionId);
    expect(activated).toMatchObject({status:"ACTIVE",pricePerStudent:100,studentCapacity:1,amountPaid:100,razorpayPaymentId:paymentId});
    const originalExpiry=activated.expiryDate;
    await activateVerifiedSubscription(paidOrder,paymentId,signature);
    await failSubscription(paidOrder);
    expect(await getSubscription(user.institutionId)).toMatchObject({status:"ACTIVE",expiryDate:originalExpiry,pricePerStudent:100,amountPaid:100});
    await expect(activateVerifiedSubscription(paidOrder,`${paymentId}_different`,signature)).rejects.toThrow("another payment");
  },15000);

  it("enforces the fixed Starter price and tenant-specific eligibility",async()=>{
    const stamp=crypto.randomUUID(),passwordHash=await hash("password123",4);
    const eligible=await createAccount({name:"Starter School",email:`starter-${stamp}@example.com`,institution:`Starter ${stamp}`,passwordHash});
    const oversized=await createAccount({name:"Large School",email:`large-${stamp}@example.com`,institution:`Large ${stamp}`,passwordHash});
    await saveSubscriptionStudentCount(eligible.institutionId,eligible.id,50);
    await saveSubscriptionStudentCount(oversized.institutionId,oversized.id,101);
    const settings=await getCompleteSettings(eligible.institutionId);
    await saveCompleteSettings(eligible.institutionId,eligible.id,{...settings,schoolCode:"TST",academicYear:"2026-2027",startMonth:4,endMonth:3,academicYears:[{name:"2026-2027",startMonth:4,endMonth:3,status:"Active"}],classes:[{name:"Class 1",sections:["A"]}]});
    await addStudent(eligible.institutionId,{name:"Starter Student",admission:`START-${stamp}`,gender:"Other",dateOfBirth:"2015-01-01",className:"Class 1",section:"A",parent:"Parent",parentPhone:"9876543210",parentEmail:"",address:"",admissionDate:"2026-04-01",totalFee:0,academicYear:"2026-2027",dueDate:"2027-03-01"},eligible.id);
    const orderId=`order_starter_${stamp}`;
    await expect(createPendingSubscription(eligible.institutionId,STARTER_PLAN_ID,`order_false_${stamp}`,50,STARTER_ANNUAL_PRICE,0)).rejects.toThrow("changed");
    await createPendingSubscription(eligible.institutionId,STARTER_PLAN_ID,orderId,1,STARTER_ANNUAL_PRICE,0);
    expect(await getSubscription(eligible.institutionId)).toMatchObject({planId:STARTER_PLAN_ID,pricingModel:"FIXED",studentCapacity:100,studentCountAtPurchase:1,amountPaid:10000,pricePerStudent:0});
    await activateVerifiedSubscription(orderId,`pay_starter_${stamp}`,"verified-test-signature");
    expect(await getVerifiedPaymentConfirmation(eligible.institutionId,"subscription",orderId)).toMatchObject({product:"subscription",schoolName:`Starter ${stamp}`,amountPaid:10000,status:"ACTIVE",paymentStatus:"Paid",orderId});
    expect(await getVerifiedPaymentConfirmation(oversized.institutionId,"subscription",orderId)).toBeUndefined();
    expect(await getSubscriptionBillingStudentCount(oversized.institutionId)).toBe(101);
    await expect(createPendingSubscription(oversized.institutionId,STARTER_PLAN_ID,`order_large_${stamp}`,101,STARTER_ANNUAL_PRICE,0)).rejects.toThrow("1–100");
    expect(await getSubscription(oversized.institutionId)).toMatchObject({status:"UNPAID",billingStudentCount:101});
  });

  it("activates a tenant-scoped WhatsApp add-on idempotently", async () => {
    const stamp = crypto.randomUUID();
    const user = await createAccount({
      name: "WhatsApp School",
      email: `whatsapp-addon-${stamp}@example.com`,
      institution: `WhatsApp School ${stamp}`,
      passwordHash: await hash("password123", 4),
    });
    const settings = await getCompleteSettings(user.institutionId);
    await saveCompleteSettings(user.institutionId, user.id, {
      ...settings,
      schoolCode: "WAP",
      academicYear: "2026-2027",
      startMonth: 4,
      endMonth: 3,
      academicYears: [
        { name: "2026-2027", startMonth: 4, endMonth: 3, status: "Active" },
      ],
      classes: [{ name: "Class 1", sections: ["A"] }],
    });
    await addStudent(
      user.institutionId,
      {
        name: "WhatsApp Student",
        admission: `WAP-${stamp}`,
        gender: "Other",
        dateOfBirth: "2015-01-01",
        className: "Class 1",
        section: "A",
        parent: "Parent",
        parentPhone: "9876543210",
        parentEmail: "",
        address: "",
        admissionDate: "2026-04-01",
        totalFee: 0,
        academicYear: "2026-2027",
        dueDate: "2027-03-01",
      },
      user.id,
      { enforceCapacity: true, allowFirstUnpaidEnrollment: true },
    );
    const orderId = `order_whatsapp_${stamp}`;
    const paymentId = `pay_whatsapp_${stamp}`;
    await createPendingWhatsAppAddon(user.institutionId, orderId, 1, 10_000);
    await activateVerifiedWhatsAppAddon(orderId, paymentId, "verified-signature");
    const active = await getWhatsAppAddonSubscription(user.institutionId);
    expect(active).toMatchObject({
      status: "ACTIVE",
      paymentStatus: "Paid",
      studentCount: 1,
      amountPaid: 10_000,
      razorpayPaymentId: paymentId,
    });
    const expiry = active?.expiryDate;
    await activateVerifiedWhatsAppAddon(orderId, paymentId, "verified-signature");
    expect(await getWhatsAppAddonSubscription(user.institutionId)).toMatchObject({
      status: "ACTIVE",
      expiryDate: expiry,
      razorpayPaymentId: paymentId,
    });
    expect(
      await getVerifiedPaymentConfirmation(
        user.institutionId,
        "whatsapp",
        orderId,
      ),
    ).toMatchObject({
      product: "whatsapp",
      schoolName: `WhatsApp School ${stamp}`,
      amountPaid: 10_000,
      status: "ACTIVE",
      paymentStatus: "Paid",
      orderId,
      paymentId,
    });
    await expect(
      activateVerifiedWhatsAppAddon(
        orderId,
        `${paymentId}_different`,
        "verified-signature",
      ),
    ).rejects.toThrow("another payment");
  });
});
