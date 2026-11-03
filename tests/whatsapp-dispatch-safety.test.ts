import{afterEach,describe,expect,it,vi}from"vitest";
import{readFileSync}from"node:fs";
import{resolve}from"node:path";
import{authorizeWhatsAppDispatch,type WhatsAppDispatchAuthorizationSnapshot}from"../src/lib/whatsapp-dispatch-policy";
import{enqueueWhatsAppFeeReminders,prepareAndQueueWhatsAppMessage,queueWhatsAppMessage,rescheduleWhatsAppMessage,retryWhatsAppMessage}from"../src/lib/db";

const base:WhatsAppDispatchAuthorizationSnapshot={dispatchEnabled:true,messageId:"message-a",messageInstitutionId:"school-a",expectedInstitutionId:"school-a",studentId:"student-a",studentInstitutionId:"school-a",studentStatus:"Active",guardianPhone:"+919111111111",queuedRecipientPhone:"+919111111111",consentStatus:"GRANTED",categoryConsent:{attendance:true,academics:false,fees:false,notices:false,general:false},configurationEnabled:true,senderVerified:true,templateEnabled:true,templateApprovalStatus:"APPROVED",templateCategory:"Attendance",messageType:"Absence Alert"};

afterEach(()=>vi.unstubAllEnvs());

describe("unit: immediate WhatsApp dispatch authorization",()=>{
 it("keeps a fresh authorization check in front of the follow-up document provider call",()=>{const source=readFileSync(resolve(process.cwd(),"src/lib/db.ts"),"utf8"),templateSend=source.indexOf("metaCloudWhatsAppProvider.sendTemplate"),secondAuthorization=source.indexOf("authorizeWhatsAppJob(current.id,current.institutionId,db,workerId)",templateSend),documentSend=source.indexOf("metaCloudWhatsAppProvider.sendDocument",templateSend);expect(templateSend).toBeGreaterThan(-1);expect(secondAuthorization).toBeGreaterThan(templateSend);expect(documentSend).toBeGreaterThan(secondAuthorization)});
 it("rejects consent withdrawn after queueing",()=>expect(authorizeWhatsAppDispatch({...base,categoryConsent:{...base.categoryConsent,attendance:false}})).toEqual({allowed:false,reason:"category_not_allowed"}));
 it("does not let consent for another category authorize the requested category",()=>expect(authorizeWhatsAppDispatch({...base,categoryConsent:{fees:true,attendance:false}})).toEqual({allowed:false,reason:"category_not_allowed"}));
 it("rejects a recipient who opted out after queueing",()=>expect(authorizeWhatsAppDispatch({...base,consentStatus:"OPTED_OUT"})).toEqual({allowed:false,reason:"recipient_opted_out"}));
 it("rejects a changed guardian relationship",()=>expect(authorizeWhatsAppDispatch({...base,guardianPhone:"+919222222222"})).toEqual({allowed:false,reason:"guardian_relationship_changed"}));
 it("rejects cross-school ownership and missing authorization data",()=>{expect(authorizeWhatsAppDispatch({...base,studentInstitutionId:"school-b"})).toEqual({allowed:false,reason:"student_relationship_missing"});expect(authorizeWhatsAppDispatch({...base,studentId:null})).toEqual({allowed:false,reason:"student_relationship_missing"})});
 it("rejects disabled dispatch, unverified senders, disabled configurations, and unavailable templates",()=>{expect(authorizeWhatsAppDispatch({...base,dispatchEnabled:false})).toEqual({allowed:false,reason:"dispatch_disabled"});expect(authorizeWhatsAppDispatch({...base,senderVerified:false})).toEqual({allowed:false,reason:"sender_unverified"});expect(authorizeWhatsAppDispatch({...base,configurationEnabled:false})).toEqual({allowed:false,reason:"configuration_disabled"});expect(authorizeWhatsAppDispatch({...base,templateApprovalStatus:"PENDING"})).toEqual({allowed:false,reason:"template_unavailable"});expect(authorizeWhatsAppDispatch({...base,templateCategory:"Fees"})).toEqual({allowed:false,reason:"template_category_mismatch"})});
 it("authorizes only a complete matching snapshot",()=>expect(authorizeWhatsAppDispatch(base)).toEqual({allowed:true,category:"attendance"}));
});

describe("unit: exported dispatch helpers fail before database access",()=>{
 it("blocks queue, preparation, retry, rescheduling, and reminders while dispatch is disabled",async()=>{
  vi.stubEnv("WHATSAPP_DISPATCH_ENABLED","0");
  const queueInput={studentId:"student-a",messageType:"Notice",templateName:"notice",language:"en",parameters:[],idempotencyKey:"request-disabled"};
  await expect(queueWhatsAppMessage("school-a","user-a",queueInput)).rejects.toThrow("dispatch is disabled");
  await expect(prepareAndQueueWhatsAppMessage("school-a","user-a",queueInput)).rejects.toThrow("dispatch is disabled");
  await expect(retryWhatsAppMessage("school-a","user-a","message-a")).rejects.toThrow("dispatch is disabled");
  await expect(rescheduleWhatsAppMessage("school-a","user-a","message-a",new Date(Date.now()+60_000))).rejects.toThrow("dispatch is disabled");
  await expect(enqueueWhatsAppFeeReminders()).rejects.toThrow("dispatch is disabled");
 });
});
