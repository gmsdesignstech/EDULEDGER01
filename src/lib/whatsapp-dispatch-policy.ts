import{messageCategory,type MessageCategory}from"./whatsapp-messaging";
import{normalizeWhatsAppNumber}from"./whatsapp";

export type WhatsAppDispatchAuthorizationSnapshot={
 dispatchEnabled:boolean;
 messageId:string;
 messageInstitutionId:string;
 expectedInstitutionId:string;
 studentId:string|null;
 studentInstitutionId:string|null;
 studentStatus:string|null;
 guardianPhone:string|null;
 queuedRecipientPhone:string;
 consentStatus:string|null;
 categoryConsent:Partial<Record<MessageCategory,boolean>>;
 configurationEnabled:boolean;
 senderVerified:boolean;
 templateEnabled:boolean;
 templateApprovalStatus:string|null;
 templateCategory:string|null;
 messageType:string;
};

export type WhatsAppDispatchAuthorization={allowed:true;category:MessageCategory}|{allowed:false;reason:string};

function templateAllows(category:MessageCategory,templateCategory:string|null){
 const normalized=(templateCategory||"").trim().toLowerCase();
 if(category==="attendance")return normalized==="attendance";
 if(category==="fees")return normalized==="fees";
 if(category==="academics")return normalized==="academics";
 return normalized==="school";
}

export function authorizeWhatsAppDispatch(snapshot:WhatsAppDispatchAuthorizationSnapshot):WhatsAppDispatchAuthorization{
 if(!snapshot.dispatchEnabled)return{allowed:false,reason:"dispatch_disabled"};
 if(!snapshot.messageId||!snapshot.expectedInstitutionId||snapshot.messageInstitutionId!==snapshot.expectedInstitutionId)return{allowed:false,reason:"institution_mismatch"};
 if(!snapshot.studentId||snapshot.studentInstitutionId!==snapshot.expectedInstitutionId)return{allowed:false,reason:"student_relationship_missing"};
 if(snapshot.studentStatus!=="Active")return{allowed:false,reason:"student_inactive"};
 if(snapshot.consentStatus!=="GRANTED")return{allowed:false,reason:snapshot.consentStatus==="OPTED_OUT"?"recipient_opted_out":"consent_missing"};
 const category=messageCategory(snapshot.messageType);
 if(snapshot.categoryConsent[category]!==true)return{allowed:false,reason:"category_not_allowed"};
 let guardian="",queued="";try{guardian=normalizeWhatsAppNumber(snapshot.guardianPhone||"");queued=normalizeWhatsAppNumber(snapshot.queuedRecipientPhone)}catch{return{allowed:false,reason:"recipient_invalid"}}
 if(!guardian||guardian!==queued)return{allowed:false,reason:"guardian_relationship_changed"};
 if(!snapshot.configurationEnabled)return{allowed:false,reason:"configuration_disabled"};
 if(!snapshot.senderVerified)return{allowed:false,reason:"sender_unverified"};
 if(!snapshot.templateEnabled||snapshot.templateApprovalStatus!=="APPROVED")return{allowed:false,reason:"template_unavailable"};
 if(!templateAllows(category,snapshot.templateCategory))return{allowed:false,reason:"template_category_mismatch"};
 return{allowed:true,category};
}
