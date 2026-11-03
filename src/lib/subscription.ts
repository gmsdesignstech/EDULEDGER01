import{createHmac,timingSafeEqual}from"node:crypto";

export type SubscriptionStatus="UNPAID"|"PENDING"|"UPCOMING"|"ACTIVE"|"EXPIRING_SOON"|"EXPIRED"|"FAILED"|"REFUNDED"|"CANCELLED"|"SUSPENDED";
export type SubscriptionPeriod={startDate:Date;endDate:Date;startMonth:number;startYear:number;endMonth:number;endYear:number};

export function parseSubscriptionPeriod(startMonth:string,endMonth:string):SubscriptionPeriod{
 const match=/^(\d{4})-(\d{2})$/;const start=match.exec(startMonth),end=match.exec(endMonth);
 if(!start||!end)throw new Error("Please select a valid subscription period.");
 const startYear=Number(start[1]),startNumber=Number(start[2]),endYear=Number(end[1]),endNumber=Number(end[2]);
 if(startYear<2000||startYear>2200||endYear<2000||endYear>2200||startNumber<1||startNumber>12||endNumber<1||endNumber>12)throw new Error("Please select a valid subscription period.");
 const startDate=new Date(Date.UTC(startYear,startNumber-1,1)),endDate=new Date(Date.UTC(endYear,endNumber,1)-1);
 if(endDate.getTime()<=startDate.getTime())throw new Error("Please select a valid subscription period.");
 return{startDate,endDate,startMonth:startNumber,startYear,endMonth:endNumber,endYear};
}
export function academicYearSubscriptionPeriod(academicYear:string,now=new Date()):SubscriptionPeriod{
 const match=/^(\d{4})\s*[-–]\s*(\d{4})$/.exec(academicYear.trim());
 if(match&&Number(match[2])===Number(match[1])+1)return parseSubscriptionPeriod(`${match[1]}-04`,`${match[2]}-03`);
 const year=now.getUTCMonth()>=3?now.getUTCFullYear():now.getUTCFullYear()-1;
 return parseSubscriptionPeriod(`${year}-04`,`${year+1}-03`);
}
export function resolveSubscriptionPeriod(start:string|Date|null|undefined,end:string|Date|null|undefined,academicYear:string,now=new Date()):SubscriptionPeriod{
 if(start&&end){const startDate=new Date(start),endDate=new Date(end);if(Number.isFinite(startDate.getTime())&&Number.isFinite(endDate.getTime())&&endDate>startDate)return{startDate,endDate,startMonth:startDate.getUTCMonth()+1,startYear:startDate.getUTCFullYear(),endMonth:endDate.getUTCMonth()+1,endYear:endDate.getUTCFullYear()};}
 return academicYearSubscriptionPeriod(academicYear,now);
}
export function formatSubscriptionPeriod(start:string|Date|null|undefined,end:string|Date|null|undefined){if(!start||!end)return"Not selected";const format=new Intl.DateTimeFormat("en-IN",{month:"long",year:"numeric",timeZone:"UTC"});return`${format.format(new Date(start))} – ${format.format(new Date(end))}`;}

export function addOneYear(date:Date){const next=new Date(date);next.setUTCFullYear(next.getUTCFullYear()+1);return next;}
export function getDaysRemaining(expiry:string|Date|undefined,now=new Date()){
 if(!expiry)return 0;
 return Math.max(0,Math.ceil((new Date(expiry).getTime()-now.getTime())/864e5));
}
export function getSubscriptionStatus(status:string|undefined,expiry:string|undefined,now=new Date(),warningDays=30,activation?:string):SubscriptionStatus{
 if(["CANCELLED","SUSPENDED","REFUNDED","FAILED","PENDING"].includes(status??""))return status as SubscriptionStatus;
 if(!expiry)return status==="ACTIVE"?"EXPIRED":"UNPAID";
 if(status==="UPCOMING"&&!activation)return"UPCOMING";
 if(activation&&new Date(activation).getTime()>now.getTime())return"UPCOMING";
 if(new Date(expiry).getTime()<=now.getTime())return"EXPIRED";
 if(status==="ACTIVE"||status==="EXPIRING_SOON")return getDaysRemaining(expiry,now)<=warningDays?"EXPIRING_SOON":"ACTIVE";
 return"UNPAID";
}
export function isSubscriptionActive(status:SubscriptionStatus){return status==="ACTIVE"||status==="EXPIRING_SOON";}
export function isVerifiedPaidSubscription(status:string|undefined,paymentStatus:string|undefined,paymentId:string|null|undefined){return paymentStatus==="Paid"&&["ACTIVE","UPCOMING","EXPIRING_SOON"].includes(status??"")&&Boolean(paymentId);}
export function verifyWebhookSignature(body:string,signature:string,secret:string){const expected=createHmac("sha256",secret).update(body).digest("hex"),a=Buffer.from(expected),b=Buffer.from(signature);return a.length===b.length&&timingSafeEqual(a,b);}
export function capacityMessage(used:number,limit:number,requested=1){return requested===1?`Student capacity reached: ${used} of ${limit} students used. Upgrade your plan to add another student.`:`Import would exceed student capacity: ${used} of ${limit} used, ${requested} new students requested.`;}
