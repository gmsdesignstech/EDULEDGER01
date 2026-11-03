export const HISTORICAL_ANNUAL_PRICE_PER_STUDENT=50;
export const NEW_SCHOOL_ANNUAL_PRICE_PER_STUDENT=100;
export const ANNUAL_PRICE_PER_STUDENT=NEW_SCHOOL_ANNUAL_PRICE_PER_STUDENT;
export const ANNUAL_SERVICE_PLAN_ID="annual-service";
export const STARTER_PLAN_ID="starter-annual-v1";
export const STARTER_ANNUAL_PRICE=10_000;
export const STARTER_STUDENT_LIMIT=100;
export const STARTER_PLAN_VERSION=1;
export const STARTER_EFFECTIVE_AT="2026-10-24T00:00:00+05:30";
export type PricingModel="FIXED"|"PER_STUDENT";
export type SubscriptionPlan={id:string;name:string;studentLimit:number;price:number;pricePerStudent:number;studentCount:number;billingPeriod:"year";pricingModel:PricingModel;version:number;effectiveAt:string|null;eligibleNewSchools:boolean;active:boolean};
export type AnnualPricingQuote={studentCount:number;amount:number;pricePerStudent:number;pricingMethod:"fixed"|"per-student"};
export function annualPricePerStudentForNewPurchase(){return ANNUAL_PRICE_PER_STUDENT}
export function annualPricingQuote(studentCount:number):AnnualPricingQuote|undefined{if(!Number.isInteger(studentCount)||studentCount<=0)return undefined;const fixed=studentCount<=STARTER_STUDENT_LIMIT;return{studentCount,amount:fixed?STARTER_ANNUAL_PRICE:studentCount*ANNUAL_PRICE_PER_STUDENT,pricePerStudent:ANNUAL_PRICE_PER_STUDENT,pricingMethod:fixed?"fixed":"per-student"}}
export function annualServicePlan(studentCount:number,pricePerStudent=ANNUAL_PRICE_PER_STUDENT):SubscriptionPlan{if(!Number.isInteger(studentCount)||studentCount<=0)throw new Error("Eligible student count must be a positive whole number.");if(!Number.isFinite(pricePerStudent)||pricePerStudent<=0)throw new Error("Subscription price must be a positive amount.");return{id:ANNUAL_SERVICE_PLAN_ID,name:"Annual Service",studentLimit:studentCount,studentCount,pricePerStudent,price:studentCount*pricePerStudent,billingPeriod:"year",pricingModel:"PER_STUDENT",version:1,effectiveAt:null,eligibleNewSchools:false,active:true}}
export function starterPlan(studentCount:number):SubscriptionPlan{if(!Number.isInteger(studentCount)||studentCount<=0)throw new Error("EduLedger Starter requires at least 1 active student.");if(studentCount>STARTER_STUDENT_LIMIT)throw new Error(`EduLedger Starter is available only to schools with 1–${STARTER_STUDENT_LIMIT} active students. Select an eligible higher-capacity plan.`);return{id:STARTER_PLAN_ID,name:"EduLedger Starter",studentLimit:STARTER_STUDENT_LIMIT,studentCount,pricePerStudent:0,price:STARTER_ANNUAL_PRICE,billingPeriod:"year",pricingModel:"FIXED",version:STARTER_PLAN_VERSION,effectiveAt:STARTER_EFFECTIVE_AT,eligibleNewSchools:true,active:true}}
export const SUBSCRIPTION_PLANS:readonly SubscriptionPlan[]=[starterPlan(1),annualServicePlan(1)];
export function getPlan(id:string,studentCount=1,pricePerStudent=ANNUAL_PRICE_PER_STUDENT){if(id===STARTER_PLAN_ID)return starterPlan(studentCount);return id===ANNUAL_SERVICE_PLAN_ID?annualServicePlan(studentCount,pricePerStudent):undefined}
export function planForStudentCount(count:number,pricePerStudent=ANNUAL_PRICE_PER_STUDENT){return Number.isInteger(count)&&count>0?annualServicePlan(count,pricePerStudent):undefined}
export function starterPlanForStudentCount(count:number){return Number.isInteger(count)&&count>0&&count<=STARTER_STUDENT_LIMIT?starterPlan(count):undefined}
export function annualSubscriptionPlan(studentCount:number){const quote=annualPricingQuote(studentCount);if(!quote)return undefined;return quote.pricingMethod==="fixed"?starterPlan(studentCount):annualServicePlan(studentCount,quote.pricePerStudent)}
export function isValidSubscriptionPricing(input:{planId:string;amountPaid:number|string;studentCount:number|string;pricePerStudent:number|string;pricingModel?:string|null}){const studentCount=Number(input.studentCount),amountPaid=Number(input.amountPaid),pricePerStudent=Number(input.pricePerStudent);if(!Number.isSafeInteger(studentCount)||studentCount<=0||!Number.isFinite(amountPaid)||!Number.isFinite(pricePerStudent))return false;if(input.planId===STARTER_PLAN_ID||input.pricingModel==="FIXED")return input.planId===STARTER_PLAN_ID&&studentCount<=STARTER_STUDENT_LIMIT&&amountPaid===STARTER_ANNUAL_PRICE&&pricePerStudent===0;return pricePerStudent>0&&amountPaid===studentCount*pricePerStudent}
export const formatInr=(amount:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(amount);
