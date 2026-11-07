import { describe,expect,it,vi } from "vitest";
import { clearPortalStorageKeys } from "../src/lib/portal-session";

describe("portal logout client cleanup",()=>{
  it("clears only the portal-specific private selection keys requested",()=>{
    const removeItem=vi.fn(),storage={removeItem};
    clearPortalStorageKeys(storage,["eduledger_parent_child"]);
    expect(removeItem).toHaveBeenCalledTimes(1);
    expect(removeItem).toHaveBeenCalledWith("eduledger_parent_child");
  });
});
