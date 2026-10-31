import { expect, it } from "vitest";
import { methodologyAffectsPublic } from "../src/security/public-impact";
import type { Tx } from "../src/lib/auth/audit";
it("does not invalidate private methodology changes, but catches visible changes including hiding",async()=>{
  let rows: {id:string}[] = [];
  const tx = {select:()=>({from:()=>({where:()=>({limit:async()=>rows})})})} as unknown as Tx;
  const id = "00000000-0000-4000-8000-000000000001";
  expect(await methodologyAffectsPublic(tx,{operation:"cases",versionId:id,data:{}})).toBe(false);
  expect(await methodologyAffectsPublic(tx,{operation:"visibility",versionId:id,isPublic:true})).toBe(true);
  expect(await methodologyAffectsPublic(tx,{operation:"metadata",id,data:{}})).toBe(false);
  rows=[{id}];
  expect(await methodologyAffectsPublic(tx,{operation:"metadata",id,data:{}})).toBe(true);
  expect(await methodologyAffectsPublic(tx,{operation:"visibility",versionId:id,isPublic:false})).toBe(true);
  expect(await methodologyAffectsPublic(tx,{operation:"criterion",id,versionId:id,data:{}})).toBe(true);
});
