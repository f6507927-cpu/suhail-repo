import { expect, test } from "@playwright/test";

test("health endpoint returns an ok status and version", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  await expect(response).toBeOK();
  expect(await response.json()).toEqual({
    status: "ok",
    version: expect.any(String),
  });
});
