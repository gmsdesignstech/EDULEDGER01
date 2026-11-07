import { describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import { createAccount, deleteSchoolAsset, getSchoolAsset, putSchoolAsset } from "../src/lib/db";

describe("private student photo assets", () => {
  it("stores photo assets with school scope and prevents cross-school reads", async () => {
    const stamp=Date.now();
    const first=await createAccount({name:"Photo School A",email:`photo-a-${stamp}@example.com`,institution:`Photo School A ${stamp}`,passwordHash:await hash("password123",4)});
    const second=await createAccount({name:"Photo School B",email:`photo-b-${stamp}@example.com`,institution:`Photo School B ${stamp}`,passwordHash:await hash("password123",4)});
    const studentId="student-photo-test",kind=`student-photo:${studentId}`,bytes=Buffer.from([0x89,0x50,0x4e,0x47]);
    await putSchoolAsset(first.institutionId,first.id,kind,"image/png",bytes);
    const stored=await getSchoolAsset(first.institutionId,kind);
    expect(stored?.mimeType).toBe("image/png");
    expect(Buffer.from(stored?.data??[])).toEqual(bytes);
    expect(await getSchoolAsset(second.institutionId,kind)).toBeUndefined();
    await deleteSchoolAsset(first.institutionId,first.id,kind);
    expect(await getSchoolAsset(first.institutionId,kind)).toBeUndefined();
  });
});
