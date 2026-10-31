import { databaseUrl } from "../../src/db/connection-url";
export { LOOPBACK_HOSTS } from "../../src/db/connection-url";

export const LOCAL_TEST_DATABASE_URL =
  "postgresql://postgres@127.0.0.1:55432/suhail_test";

export function testDatabaseUrl(): string {
  return databaseUrl(
    "DATABASE_URL_TEST",
    process.env.DATABASE_URL_TEST === undefined
      ? LOCAL_TEST_DATABASE_URL
      : process.env.DATABASE_URL_TEST,
  );
}
