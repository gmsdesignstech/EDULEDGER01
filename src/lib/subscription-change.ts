import { annualPricingQuote } from "./subscription-plans";

export type CapacityChangeQuote={currentCapacity:number;requestedCapacity:number;activeStudents:number;currentAnnualAmount:number;newAnnualAmount:number;remainingDays:number;totalDays:number;amountDue:number;creditAmount:number;direction:"increase"|"decrease"|"unchanged";expiresAt:string};

export function subscriptionCapacityQuote(input:{currentCapacity:number;requestedCapacity:number;activeStudents:number;currentAnnualAmount:number;startsAt:string;expiresAt:string;now?:Date}):CapacityChangeQuote{
 const requested=Math.trunc(input.requestedCapacity),current=Math.trunc(input.currentCapacity);
 if(!Number.isSafeInteger(requested)||requested<1||requested>100000)throw new Error("Student capacity must be between 1 and 100,000.");
 if(requested<input.activeStudents)throw new Error(`Capacity cannot be lower than ${input.activeStudents} active students.`);
 const next=annualPricingQuote(requested);if(!next)throw new Error("Invalid student capacity.");
 const start=new Date(input.startsAt),end=new Date(input.expiresAt),now=input.now??new Date();
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)throw new Error("Subscription period is invalid.");
 const day=864e5,totalDays=Math.max(1,Math.ceil((end.getTime()-start.getTime())/day)),remainingDays=Math.max(0,Math.min(totalDays,Math.ceil((end.getTime()-now.getTime())/day))),difference=next.amount-Number(input.currentAnnualAmount),prorated=Math.round(Math.abs(difference)*remainingDays/totalDays);
 return{currentCapacity:current,requestedCapacity:requested,activeStudents:input.activeStudents,currentAnnualAmount:Number(input.currentAnnualAmount),newAnnualAmount:next.amount,remainingDays,totalDays,amountDue:difference>0?prorated:0,creditAmount:difference<0?prorated:0,direction:difference>0?"increase":difference<0?"decrease":"unchanged",expiresAt:end.toISOString()};
}
