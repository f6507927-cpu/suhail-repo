import { describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";
import { verifyRuntimeRole } from "../src/db/verified-sql";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

// Model postgres-js's documented lazy PendingQuery APIs: creating a query or
// chaining values/simple/describe does not send it until execution or await.
function pending(send: () => Promise<unknown>) {
  let execution: Promise<unknown> | undefined;
  const wait = () => (execution ??= send());
  const query = {
    then: (...args: Parameters<Promise<unknown>["then"]>) =>
      wait().then(...args),
    catch: (...args: Parameters<Promise<unknown>["catch"]>) =>
      wait().catch(...args),
    finally: (...args: Parameters<Promise<unknown>["finally"]>) =>
      wait().finally(...args),
    execute() {
      void wait();
      return query;
    },
    forEach() {
      void wait();
      return query;
    },
    values() {
      return query;
    },
    raw() {
      return query;
    },
    simple() {
      return query;
    },
    describe() {
      return query;
    },
    readable: () => wait(),
    writable: () => wait(),
    cursor(callback?: () => void) {
      if (callback) return query;
      return {
        [Symbol.asyncIterator]: () => ({
          next: () => wait().then((value) => ({ value, done: false })),
          return: () => ({ done: true }),
        }),
      };
    },
  };
  return query;
}

function fixture() {
  const check = deferred<unknown>();
  const sent: string[] = [];
  const create = (text: string) =>
    pending(() => {
      sent.push(text);
      return text === "select current_user"
        ? check.promise
        : Promise.resolve([{ ok: true }]);
    });
  const raw = Object.assign(
    (parts: TemplateStringsArray) => create(parts.join("?")),
    {
      unsafe: vi.fn((text: string) => create(text)),
      end: vi.fn(async () => {}),
      // Unlike lazy unsafe(), postgres-js notify starts execution immediately.
      notify: vi.fn(async () => { sent.push("notify"); return []; }),
      begin: vi.fn(async (callback: (sql: unknown) => unknown) => {
        sent.push("begin");
        return callback(raw);
      }),
      reserve: vi.fn(async () => {
        sent.push("reserve");
        return raw;
      }),
      file: vi.fn(async () => {
        sent.push("file");
        return [];
      }),
      listen: vi.fn(async () => {
        sent.push("listen");
        return [];
      }),
      subscribe: vi.fn(async () => {
        sent.push("subscribe");
        return [];
      }),
      largeObject: vi.fn(async () => {
        sent.push("largeObject");
        return [];
      }),
    },
  );
  const guarded = verifyRuntimeRole(raw as unknown as Sql, "DATABASE_URL_APP");
  return { raw, guarded, check, sent };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("first-use role verification", () => {
  it("does not query during construction or synchronous builder chaining", () => {
    const f = fixture();
    f.guarded.unsafe("business").values().simple().describe();
    expect(f.sent).toEqual([]);
  });
  it("checks once before concurrent business queries and retains chainable results", async () => {
    const f = fixture();
    const one = Promise.resolve(f.guarded.unsafe("one").values().simple());
    const two = Promise.resolve(f.guarded.unsafe("two").raw());
    await tick();
    expect(f.sent).toEqual(["select current_user"]);
    f.check.resolve([{ current_user: "suhail_app" }]);
    await expect(one).resolves.toEqual([{ ok: true }]);
    await two;
    await f.guarded.unsafe("three");
    expect(f.sent).toEqual(["select current_user", "one", "two", "three"]);
  });
  it.each(["postgres", "suhail_public", "unexpected", undefined])(
    "closes and permanently refuses mismatched app role %s",
    async (role) => {
      const f = fixture();
      const query = Promise.resolve(f.guarded.unsafe("business"));
      f.check.resolve([{ current_user: role }]);
      await expect(query).rejects.toThrow("DATABASE_URL_APP");
      await expect(f.guarded.unsafe("later")).rejects.toThrow(
        "DATABASE_URL_APP",
      );
      expect(f.sent).toEqual(["select current_user"]);
      expect(f.raw.end).toHaveBeenCalledExactlyOnceWith({ timeout: 0 });
    },
  );
  it("requires the public role for public clients", async () => {
    const f = fixture();
    const publicClient = verifyRuntimeRole(
      f.raw as unknown as Sql,
      "DATABASE_URL_PUBLIC",
    );
    f.check.resolve([{ current_user: "suhail_public" }]);
    await publicClient.unsafe("public read");
    expect(f.sent).toEqual(["select current_user", "public read"]);
  });
  it("refuses an application role on a public client", async () => {
    const f = fixture();
    const publicClient = verifyRuntimeRole(
      f.raw as unknown as Sql,
      "DATABASE_URL_PUBLIC",
    );
    f.check.resolve([{ current_user: "suhail_app" }]);
    await expect(publicClient.unsafe("public read")).rejects.toThrow(
      "DATABASE_URL_PUBLIC",
    );
    expect(f.sent).toEqual(["select current_user"]);
  });
  it.each([
    { rows: [] },
    { rows: [{ current_user: "suhail_app" }, { current_user: "suhail_app" }] },
  ])("refuses unexpected identity result shape", async ({ rows }) => {
    const f = fixture();
    f.check.resolve(rows);
    await expect(f.guarded.unsafe("business")).rejects.toThrow(
      "verification failed",
    );
    expect(f.sent).toEqual(["select current_user"]);
  });
  it("sanitizes failed identity queries and failed connection closure", async () => {
    const f = fixture();
    f.raw.end.mockRejectedValueOnce(new Error("private-close-detail"));
    const query = Promise.resolve(f.guarded.unsafe("business"));
    await tick();
    f.check.reject(new Error("private-password-and-host"));
    await expect(query).rejects.toThrow("DATABASE_URL_APP");
    await expect(query).rejects.not.toThrow("private");
    expect(f.sent).toEqual(["select current_user"]);
  });
  it.each(["execute", "forEach"] as const)(
    "gates explicit %s without losing query chaining",
    async (method) => {
      const f = fixture();
      const query =
        method === "execute"
          ? f.guarded.unsafe("business").execute()
          : f.guarded.unsafe("business").forEach(() => {});
      await tick();
      expect(f.sent).toEqual(["select current_user"]);
      f.check.resolve([{ current_user: "suhail_app" }]);
      await query;
      expect(f.sent).toEqual(["select current_user", "business"]);
    },
  );
  it("gates tagged queries and transaction callbacks", async () => {
    const f = fixture();
    const tag = Promise.resolve(f.guarded`tagged business`);
    const transaction = f.guarded.begin(async (tx) => {
      await tx.unsafe("transaction business");
      return "done";
    });
    await tick();
    expect(f.raw.begin).not.toHaveBeenCalled();
    f.check.resolve([{ current_user: "suhail_app" }]);
    await tag;
    await expect(transaction).resolves.toBe("done");
    expect(f.sent[0]).toBe("select current_user");
    expect(f.sent).toContain("transaction business");
  });
  it.each(["reserve", "file", "listen", "subscribe", "largeObject"] as const)(
    "cannot bypass verification via %s",
    async (method) => {
      const f = fixture();
      const query = Reflect.apply(
        Reflect.get(f.guarded, method),
        f.guarded,
        [],
      );
      await tick();
      expect(f.raw[method]).not.toHaveBeenCalled();
      f.check.resolve([{ current_user: "postgres" }]);
      await expect(query).rejects.toThrow("verification failed");
      expect(f.raw[method]).not.toHaveBeenCalled();
    },
  );
  it.each(["readable", "writable"] as const)(
    "gates %s streaming",
    async (method) => {
      const f = fixture();
      const stream = f.guarded.unsafe("business")[method]();
      await tick();
      expect(f.sent).toEqual(["select current_user"]);
      f.check.resolve([{ current_user: "suhail_app" }]);
      await stream;
      expect(f.sent).toEqual(["select current_user", "business"]);
    },
  );
  it("gates cursor iteration", async () => {
    const f = fixture();
    const iterator = f.guarded
      .unsafe("business")
      .cursor()
      [Symbol.asyncIterator]();
    const next = iterator.next();
    await tick();
    expect(f.sent).toEqual(["select current_user"]);
    f.check.resolve([{ current_user: "suhail_app" }]);
    await next;
    expect(f.sent).toEqual(["select current_user", "business"]);
  });
  it("gates eager notify until role verification completes",async()=>{
    const f=fixture();
    const result=f.guarded.notify("fixture","payload");
    await tick();
    expect(f.sent).toEqual(["select current_user"]);
    expect(f.raw.notify).not.toHaveBeenCalled();
    f.check.resolve([{current_user:"suhail_app"}]);
    await result;
    expect(f.sent).toEqual(["select current_user","notify"]);
  });
  it("a refused role never executes eager notify",async()=>{
    const f=fixture();
    const result=f.guarded.notify("fixture","payload");
    f.check.resolve([{current_user:"postgres"}]);
    await expect(result).rejects.toThrow("DATABASE_URL_APP");
    expect(f.raw.notify).not.toHaveBeenCalled();
  });
  it("allows shutdown without opening a connection", async () => {
    const f = fixture();
    await f.guarded.end();
    expect(f.raw.end).toHaveBeenCalledOnce();
    expect(f.sent).toEqual([]);
  });
});
