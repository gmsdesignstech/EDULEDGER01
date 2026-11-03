import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { annualSubscriptionPlan } from "@/lib/subscription-plans";
import { createRazorpayOrder, getCapturedRazorpayPaymentForOrder, PaymentServiceError, paymentErrorMessage, razorpayPublicKey } from "@/lib/payment";
import { activateVerifiedSubscription, createPendingSubscription, findReusablePendingSubscription, getSubscriptionBillingStudentCount } from "@/lib/db";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if(user.role!=="SCHOOL_ADMIN")return NextResponse.json({error:"Only a school administrator can purchase a subscription."},{status:403});
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({error:"Invalid checkout request."},{status:400});
  const studentCount=await getSubscriptionBillingStudentCount(user.institutionId);
  if(!studentCount)return NextResponse.json({error:"Enter the school’s expected enrollment before starting annual subscription checkout.",code:"NO_ELIGIBLE_STUDENTS",verifiedStudentCount:0},{status:409});
  const plan=annualSubscriptionPlan(studentCount);
  if(!plan)return NextResponse.json({error:"This school is not eligible for the selected plan."},{status:409});
  try {
    const reusable=await findReusablePendingSubscription(user.institutionId,plan.id,plan.studentCount,plan.price);
    if(reusable){
      const captured=await getCapturedRazorpayPaymentForOrder(reusable.orderId);
      if(captured){
        if(captured.amount!==plan.price*100||captured.currency!=="INR")return NextResponse.json({error:"The captured payment does not match the pending subscription order. Please contact support before retrying.",code:"PAYMENT_MISMATCH"},{status:409});
        await activateVerifiedSubscription(reusable.orderId,captured.id,"provider-reconciliation");
        return NextResponse.json({id:reusable.orderId,key:razorpayPublicKey(),amount:plan.price*100,currency:"INR",planName:plan.name,studentCount:plan.studentCount,pricePerStudent:plan.pricePerStudent,reused:true,verified:true});
      }
      return NextResponse.json({id:reusable.orderId,key:razorpayPublicKey(),amount:plan.price*100,currency:"INR",planName:plan.name,studentCount:plan.studentCount,pricePerStudent:plan.pricePerStudent,reused:true,verified:false});
    }
    const order = await createRazorpayOrder({
      amount: plan.price * 100,
      receipt: `sub_${Date.now()}`,
      notes: { institutionId: user.institutionId,planId:plan.id,studentCount:String(plan.studentCount),pricingModel:plan.pricingModel,planVersion:String(plan.version) },
    });
    await createPendingSubscription(user.institutionId, plan.id, order.id,plan.studentCount,plan.price,plan.pricePerStudent);
    return NextResponse.json({ ...order, planName: plan.name,studentCount:plan.studentCount,pricePerStudent:plan.pricePerStudent });
  } catch (error) {
    console.error("Subscription order creation failed",error instanceof Error?{name:error.name,message:error.message}:error);
    if(error instanceof Error&&(error.message.includes("subscription period")||error.message.includes("overlaps")))return NextResponse.json({error:error.message},{status:409});
    if(error instanceof Error&&error.message.includes("eligible student count or agreed price changed")){
      const verifiedStudentCount=await getSubscriptionBillingStudentCount(user.institutionId),updatedPlan=annualSubscriptionPlan(verifiedStudentCount);
      return NextResponse.json({error:"The eligible student count changed before checkout. Review the updated total and try again.",code:"STUDENT_COUNT_CHANGED",verifiedStudentCount,amount:updatedPlan?.price??0,pricePerStudent:updatedPlan?.pricePerStudent??0,planId:updatedPlan?.id??null},{status:409});
    }
    return NextResponse.json(
      {error:paymentErrorMessage(error),code:error instanceof PaymentServiceError?error.code:"ORDER_CREATION_FAILED"},
      { status:error instanceof PaymentServiceError?error.status:503 },
    );
  }
}
