import{createHash}from"node:crypto";import{maskWhatsAppNumber,normalizeWhatsAppNumber}from"./whatsapp";

export type ConsentStatus="GRANTED"|"OPTED_OUT"|"UNKNOWN";
export type MessageCategory="attendance"|"fees"|"academics"|"notices"|"general";
export type AudienceRecord={studentId:string;studentName:string;className:string;section:string;guardianName:string;phone:string;studentStatus:string;consentStatus:ConsentStatus;categoryAllowed:boolean;values:Record<string,string>};
export type TemplateRecord={name:string;language:string;enabled:boolean;approvalStatus:string;variables:string[]};
export type PreparedRecipient={studentId:string;maskedPhone:string;recipientKey:string;parameters:string[]};
export type ExclusionReason="inactive_student"|"missing_contact"|"invalid_contact"|"unknown_consent"|"opted_out"|"category_not_allowed"|"unresolved_variables"|"template_unavailable";
const UNSAFE_DETAIL_VARIABLE=/(?:mark|score|percentage|grade|fee|amount|balance|ledger|receipt|address|phone|admission|roll|date_of_birth)/i;
export function whatsappTemplateVariablesSafe(variables:string[]){return variables.every(variable=>/^[a-z][a-z0-9_]{0,63}$/.test(variable)&&!UNSAFE_DETAIL_VARIABLE.test(variable))}

export function messageCategory(type:string):MessageCategory{if(/attendance|absence|late/i.test(type))return"attendance";if(/fee|receipt|payment/i.test(type))return"fees";if(/mark|result|report|exam|timetable|academic schedule/i.test(type))return"academics";if(/notice|announcement|holiday|closure|emergency/i.test(type))return"notices";return"general"}
export function prepareRecipient(record:AudienceRecord,template:TemplateRecord){
 const excluded=(reason:ExclusionReason)=>({eligible:false as const,reason});
 if(record.studentStatus!=="Active")return excluded("inactive_student");
 if(!record.phone.trim())return excluded("missing_contact");
 let normalized:string;try{normalized=normalizeWhatsAppNumber(record.phone)}catch{return excluded("invalid_contact")}
 if(record.consentStatus==="OPTED_OUT")return excluded("opted_out");
 if(record.consentStatus!=="GRANTED")return excluded("unknown_consent");
 if(!record.categoryAllowed)return excluded("category_not_allowed");
 if(!template.enabled||template.approvalStatus!=="APPROVED"||!whatsappTemplateVariablesSafe(template.variables))return excluded("template_unavailable");
 const parameters=template.variables.map(variable=>record.values[variable]?.trim()||"");
 if(parameters.some(value=>!value))return excluded("unresolved_variables");
 return{eligible:true as const,recipient:{studentId:record.studentId,maskedPhone:maskWhatsAppNumber(normalized),recipientKey:createHash("sha256").update(normalized).digest("hex"),parameters} satisfies PreparedRecipient};
}

export function buildAudiencePreview(records:AudienceRecord[],template:TemplateRecord,criteria:Record<string,string>){
 const eligible:PreparedRecipient[]=[],excluded:Record<ExclusionReason,number>={inactive_student:0,missing_contact:0,invalid_contact:0,unknown_consent:0,opted_out:0,category_not_allowed:0,unresolved_variables:0,template_unavailable:0};
 for(const record of records){const result=prepareRecipient(record,template);if(result.eligible)eligible.push(result.recipient);else excluded[result.reason]++}
 const uniqueGuardianRecipients=new Set(eligible.map(item=>item.recipientKey)).size;
 const fingerprint=createHash("sha256").update(JSON.stringify({criteria,template:template.name,students:eligible.map(item=>item.studentId).sort(),recipientKeys:eligible.map(item=>item.recipientKey).sort()})).digest("hex");
 return{criteria,matchingStudents:records.length,eligibleMessages:eligible.length,uniqueGuardianRecipients,sharedGuardianLinks:eligible.length-uniqueGuardianRecipients,excluded,template:{name:template.name,language:template.language,approvalStatus:template.approvalStatus,variables:template.variables},recipients:eligible.map(({recipientKey,...item})=>item),fingerprint};
}
