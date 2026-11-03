import {describe,expect,it} from "vitest";
import {persistWhatsAppWebhookAtomically} from "../src/lib/whatsapp-webhook-transaction";

type State={events:Set<string>;status:string;mutations:number};

function harness(initial?:Partial<{events:string[];status:string}>){
 const state:State={events:new Set(initial?.events||[]),status:initial?.status||"Sent",mutations:0},calls:string[]=[];
 const boundary={async begin<T>(callback:(transaction:State)=>Promise<T>){calls.push("begin");const snapshot={events:new Set(state.events),status:state.status,mutations:state.mutations};try{const result=await callback(state);calls.push("commit");return result}catch(error){state.events=snapshot.events;state.status=snapshot.status;state.mutations=snapshot.mutations;calls.push("rollback");throw error}}};
 const insert=(key:string)=>(tx:State)=>{calls.push("insert");if(tx.events.has(key))return Promise.resolve(false);tx.events.add(key);return Promise.resolve(true)};
 const apply=(next:string,fail=false)=>(tx:State)=>{calls.push("apply");if(fail)throw new Error("synthetic status failure");const rank:{[key:string]:number}={Sent:1,Delivered:2,Read:3};if((rank[next]||0)<=(rank[tx.status]||0))return Promise.resolve(0);tx.status=next;tx.mutations++;return Promise.resolve(1)};
 return{state,calls,boundary,insert,apply};
}

describe("atomic WhatsApp webhook persistence",()=>{
 it("commits a new event and its status mutation together",async()=>{const h=harness();await expect(persistWhatsAppWebhookAtomically(h.boundary,h.insert("event-1"),h.apply("Delivered"))).resolves.toEqual({duplicate:false,updated:1});expect([...h.state.events]).toEqual(["event-1"]);expect(h.state.status).toBe("Delivered");expect(h.calls).toEqual(["begin","insert","apply","commit"])});
 it("rolls back the event when status mutation fails and succeeds on retry",async()=>{const h=harness();await expect(persistWhatsAppWebhookAtomically(h.boundary,h.insert("event-1"),h.apply("Delivered",true))).rejects.toThrow("synthetic status failure");expect([...h.state.events]).toEqual([]);expect(h.state.status).toBe("Sent");expect(h.calls).toEqual(["begin","insert","apply","rollback"]);await expect(persistWhatsAppWebhookAtomically(h.boundary,h.insert("event-1"),h.apply("Delivered"))).resolves.toEqual({duplicate:false,updated:1});expect(h.state.status).toBe("Delivered")});
 it("makes a successful duplicate a logical no-op",async()=>{const h=harness();await persistWhatsAppWebhookAtomically(h.boundary,h.insert("event-1"),h.apply("Delivered"));await expect(persistWhatsAppWebhookAtomically(h.boundary,h.insert("event-1"),h.apply("Delivered"))).resolves.toEqual({duplicate:true,updated:0});expect(h.state.mutations).toBe(1)});
 it("recovers a legacy event whose status mutation never committed",async()=>{const h=harness({events:["legacy-event"],status:"Sent"});await expect(persistWhatsAppWebhookAtomically(h.boundary,h.insert("legacy-event"),h.apply("Delivered"))).resolves.toEqual({duplicate:true,updated:1});expect(h.state.status).toBe("Delivered")});
 it("does not let an older duplicate regress a later status",async()=>{const h=harness({events:["old-event"],status:"Read"});await expect(persistWhatsAppWebhookAtomically(h.boundary,h.insert("old-event"),h.apply("Delivered"))).resolves.toEqual({duplicate:true,updated:0});expect(h.state.status).toBe("Read")});
 it("commits an uncorrelated event without mutating an unrelated tenant message",async()=>{const h=harness({status:"Delivered"});const unrelatedTenantStatus=h.state.status;await expect(persistWhatsAppWebhookAtomically(h.boundary,h.insert("unknown-provider-event"),async()=>0)).resolves.toEqual({duplicate:false,updated:0});expect(h.state.status).toBe(unrelatedTenantStatus);expect([...h.state.events]).toEqual(["unknown-provider-event"])});
});
