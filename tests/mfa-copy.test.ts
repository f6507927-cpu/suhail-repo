import { describe, expect, it } from "vitest";
import { reviewText } from "../src/components/accounts/types";

const approvedHelpers = [
  ["Admin access requires a time-based authenticator. Your role alone does not grant access.",
    "يتطلب الدخول إلى الإدارة تطبيق مصادقة يُنشئ رموزًا مؤقتة. دور الحساب وحده لا يمنحك حق الدخول."],
  ["If scanning is unavailable, enter this key manually.",
    "إذا تعذّر مسح الرمز، فأدخل مفتاح الإعداد يدويًا في تطبيق المصادقة."],
  ["QR code unavailable. Use the setup key instead.",
    "رمز الاستجابة السريعة غير متاح. استخدم مفتاح الإعداد بدلًا منه."],
] as const;

describe("Founder-approved authenticator helper text", () => {
  it.each(approvedHelpers)("uses exact approved Arabic for %s without changing English", (english, arabic) => {
    expect(reviewText("ar", english)).toBe(arabic);
    expect(reviewText("ar", english)).not.toContain("AR-REVIEW");
    expect(reviewText("en", english)).toBe(english);
  });

  it("uses the D-101 approved enrollment error but keeps unknown copy marked", () => {
    expect(reviewText("ar", "Could not prepare authenticator enrollment. Try again."))
      .toBe("تعذّر تجهيز إعداد تطبيق المصادقة. حاول مجددًا.");
    expect(reviewText("ar", "Unapproved enrollment error"))
      .toBe("⟦AR-REVIEW⟧ Unapproved enrollment error");
  });
});
