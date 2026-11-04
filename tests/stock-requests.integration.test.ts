import { afterAll,beforeAll,describe,expect,it,vi } from "vitest";
import { randomUUID } from "node:crypto";
import postgres,{type Sql} from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { cliConnection } from "../scripts/db/connection";
import { testDatabaseUrl } from "../scripts/db/test-target";
import { applyMigrations } from "../scripts/db/migrate";
import * as schema from "../src/db/schema";
const boundary=vi.hoisted(()=>({actor:"",db:undefined as unknown as typeof import("../src/db/app").dbApp}));
vi.mock("server-only",()=>({}));
// Auth is isolated at this suite's module boundary, never in application code.
vi.mock("../src/lib/auth/guards",()=>({requireRole:async()=>({user:{id:boundary.actor}})}));
vi.mock("../src/db/app",()=>({get dbApp(){return boundary.db;}}));
import { createStockRequest,getOwnStockRequests,removeStockRequest } from "../src/lib/stock-requests";
import { getUnmetSearches } from "../src/lib/financial/unmet-search";
let owner:Sql,app:Sql,publicRole:Sql;
const people:string[]=[];
const query=`request-${randomUUID().slice(0,8)}`;
async function actor(){
  const id=randomUUID();people.push(id);
  await owner`insert into app.users(id,full_name) values(${id},'Stock request fixture')`;
  boundary.actor=id;return id;
}
beforeAll(async()=>{
  owner=cliConnection("DATABASE_URL_TEST");
  await applyMigrations(owner);
  app=postgres(testDatabaseUrl(),{max:8,prepare:false,connection:{options:"-c role=suhail_app"}});
  publicRole=postgres(testDatabaseUrl(),{max:1,prepare:false,connection:{options:"-c role=suhail_public"}});
  boundary.db=drizzle(app,{schema});
});
afterAll(async()=>{
  if(owner){
    await owner`delete from app.stock_request where user_id=any(${people}::uuid[])`;
    await owner`delete from app.users where id=any(${people}::uuid[])`;
    await owner`delete from app.unmet_search where normalized_query=any(${[query,query+"a",query+"z"]})`;
  }
  await Promise.all([owner?.end(),app?.end(),publicRole?.end()]);
});
describe("owned stock request persistence",()=>{
  it("deduplicates normalized queries and isolates list/delete by the verified actor",async()=>{
    const first=await actor();
    expect(await createStockRequest("  AAPL ")).toBe("created");
    expect(await createStockRequest("aapl")).toBe("already_requested");
    expect((await getOwnStockRequests()).map(row=>row.normalized_query)).toEqual(["aapl"]);
    await actor();
    expect(await getOwnStockRequests()).toEqual([]);
    await removeStockRequest("aapl");
    expect(await owner`select 1 from app.stock_request where user_id=${first}`).toHaveLength(1);
    boundary.actor=first;
    await removeStockRequest(" AAPL ");
    expect(await getOwnStockRequests()).toEqual([]);
  });
  it("caps concurrent inserts at twenty, allows duplicate-at-cap and frees a slot on removal",async()=>{
    await actor();
    const results=await Promise.all(Array.from({length:24},(_,i)=>createStockRequest(`pending-${i}`)));
    expect(results.filter(result=>result==="created")).toHaveLength(20);
    expect(results.filter(result=>result==="limit_reached")).toHaveLength(4);
    const rows=await getOwnStockRequests();expect(rows).toHaveLength(20);
    expect(await createStockRequest(rows[0].normalized_query)).toBe("already_requested");
    await removeStockRequest(rows[0].normalized_query);
    expect(await createStockRequest("new-after-removal")).toBe("created");
    expect(await getOwnStockRequests()).toHaveLength(20);
  });
  it("fails closed for a repeatable-read snapshot rather than allowing stale-count inserts",async()=>{
    await actor();
    await expect(app.begin("isolation level repeatable read",tx=>tx`insert into app.stock_request(user_id,normalized_query) values(${boundary.actor},'isolation')`)).rejects.toMatchObject({code:"0A000"});
  });
  it("cascades rows when the owning account is deleted",async()=>{
    const id=await actor();await createStockRequest("cascade-check");
    await owner`delete from app.users where id=${id}`;
    expect(await owner`select 1 from app.stock_request where user_id=${id}`).toHaveLength(0);
  });
  it("denies public access and enforces the length constraint in PostgreSQL",async()=>{
    const [grants]=await owner`select
      has_table_privilege('suhail_app','app.stock_request','SELECT') read,
      has_table_privilege('suhail_app','app.stock_request','INSERT') insert,
      has_table_privilege('suhail_app','app.stock_request','DELETE') delete,
      has_table_privilege('suhail_app','app.stock_request','UPDATE') update`;
    expect(grants).toEqual({read:true,insert:true,delete:true,update:false});
    await expect(publicRole`select * from app.stock_request`).rejects.toMatchObject({code:"42501"});
    await expect(publicRole`insert into app.stock_request(user_id,normalized_query) values(${randomUUID()},'no')`).rejects.toMatchObject({code:"42501"});
    await actor();
    for(const invalid of ["","x".repeat(41)]){
      await expect(app`insert into app.stock_request(user_id,normalized_query) values(${boundary.actor},${invalid})`).rejects.toMatchObject({code:"23514"});
    }
  });
  it("adds only distinct-user totals to the admin panel without changing unmet-search recording",async()=>{
    const first=await actor();await createStockRequest(query);
    await createStockRequest(query);
    await actor();await createStockRequest(query);
    await owner`insert into app.unmet_search(normalized_query,calendar_day,count) values(${query},current_date,1000000)`;
    const row=(await getUnmetSearches()).find(row=>row.query===query);
    expect(row).toEqual({query,count:1000000,requests:2});
    expect(Object.keys(row!).sort()).toEqual(["count","query","requests"]);
    boundary.actor=first;await removeStockRequest(query);
    expect((await getUnmetSearches()).find(row=>row.query===query)).toEqual({query,count:1000000,requests:1});
    // Retain the existing exact SQL ranking even beyond JS integer precision.
    await owner`insert into app.unmet_search(normalized_query,calendar_day,count)
      values(${query+"a"},current_date,9007199254740992),(${query+"z"},current_date,9007199254740993)`;
    expect((await getUnmetSearches()).slice(0,2).map(row=>row.query)).toEqual([query+"z",query+"a"]);
  });
});
