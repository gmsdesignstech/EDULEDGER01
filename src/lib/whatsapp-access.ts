export type WhatsAppPermission=
 |"configuration:view"|"configuration:manage"|"contacts:view"|"consent:manage"
 |"messages:view"|"messages:send"|"messages:bulk"|"messages:schedule"
 |"attendance:send"|"fees:send"|"results:send"|"templates:manage";

const grants:Record<string,readonly WhatsAppPermission[]>={
 SUPER_ADMIN:["configuration:view","configuration:manage","contacts:view","consent:manage","messages:view","messages:send","messages:bulk","messages:schedule","attendance:send","fees:send","results:send","templates:manage"],
 SCHOOL_ADMIN:["configuration:view","configuration:manage","contacts:view","consent:manage","messages:view","messages:send","messages:bulk","messages:schedule","attendance:send","fees:send","results:send","templates:manage"],
 TEACHER:["contacts:view","messages:send","attendance:send","results:send"],
 ACCOUNTANT:["contacts:view","messages:send","fees:send"],
};

export function hasWhatsAppPermission(role:string,permission:WhatsAppPermission){return grants[role]?.includes(permission)??false}
export function permissionForMessageType(type:string):WhatsAppPermission{
 if(/attendance|absence|late/i.test(type))return"attendance:send";
 if(/fee|receipt|payment/i.test(type))return"fees:send";
 if(/mark|result|report|exam/i.test(type))return"results:send";
 return"messages:send";
}
