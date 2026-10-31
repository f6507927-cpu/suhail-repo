import { cookies as fixtureCookies } from "./state";
export async function cookies() {
  return { getAll: fixtureCookies, set() {} };
}
export async function headers() {
  return new Headers({ "x-private-path": "/admin/methodologies" });
}
