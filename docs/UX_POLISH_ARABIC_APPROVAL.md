# UX polish: Arabic strings for founder approval

Status: **pending founder approval**. Nothing in this table is approved. These
strings live in `src/i18n/proposed-arabic-ux-polish.ts` and
`content/glossary/glossary.json`, apart from the approved registries
(`approved-arabic*.ts`), and they must not be added to those registries until the
founder approves them. `tests/ux-polish.test.tsx` fails if any proposed string is
missing from this file.

Existing approved wording is reused wherever it exists: the status labels
(`ar.json` → `status.*`), the criterion labels (UI-1 and earlier approvals) and the
«سهيل» wordmark. Placeholders in braces are filled at render time from stored data
only.

## 1. One-sentence answer (stock hero)

The sentence is built from fixed templates. `{company}` is the stored company
name (Arabic if stored, otherwise English). `{status}` is the approved status
label. `{label}` is the approved criterion label of the first stored status reason.
It is never AI text and never changes a status, number or source.

| Key | English | Arabic (proposed) |
| --- | --- | --- |
| answerPass | {company}: {status} under the selected methodology. | {company}: {status} وفق المنهجية المختارة. |
| answerWithReason | {company}: {status}, because {reason}. | {company}: {status}، لأن {reason}. |
| answerPlain | {company}: {status}. | {company}: {status}. |
| reasonFailure | the {label} criterion did not pass | معيار {label} لم يجتز الفحص |
| reasonBorderline | the {label} criterion is close to its limit | معيار {label} قريب من حدّه |
| reasonUnknown | data for the {label} criterion is not available | بيانات معيار {label} غير متوفرة |

Example: «أبل: يحتاج إلى مراجعة، لأن بيانات معيار الإيرادات غير المباحة إلى إجمالي الإيرادات غير متوفرة.»

Reason priority: failure, then blocking unknown, criterion unknown, review unknown,
then borderline. Count-only reasons are skipped. If no stored reason can be read,
the plain template is used.

## 2. Recently viewed (homepage)

| Key | English | Arabic (proposed) |
| --- | --- | --- |
| recentTitle | Stocks you viewed recently | أسهم شاهدتها مؤخرًا |
| recentNote | Saved only in this browser. | محفوظة في هذا المتصفح فقط. |
| recentClear | Clear | مسح |
| recentClearLabel | Clear stocks you viewed recently | مسح الأسهم التي شاهدتها مؤخرًا |

## 3. Tap-to-explain

| Key | English | Arabic (proposed) |
| --- | --- | --- |
| termClose | Close | إغلاق |

### Glossary definitions (`content/glossary/glossary.json`)

The term titles reuse the approved line-item labels («الديون بفوائد»,
«أساس القيمة السوقية», «الإيرادات غير المباحة»). Only the definitions are new.

| Term | English | Arabic (proposed) |
| --- | --- | --- |
| interest_bearing_debt | Money the company has borrowed and pays interest on, such as loans and bonds. The methodology compares it with the market value basis. | أموال اقترضتها الشركة وتدفع عليها فوائد، مثل القروض والسندات. تقارن المنهجية هذا الرقم بأساس القيمة السوقية. |
| market_value_basis | The company's market value used as the base of this ratio, calculated as the selected methodology defines it. The full record shows the figure and its source. | القيمة السوقية للشركة المستخدمة أساسًا لهذه النسبة، محسوبةً كما تحددها المنهجية المختارة. يعرض السجل الكامل الرقم ومصدره. |
| prohibited_income | Revenue from activities the methodology does not permit, such as interest income. The methodology compares it with total revenue. | إيرادات من أنشطة لا تجيزها المنهجية، مثل إيرادات الفوائد. تقارن المنهجية هذا الرقم بإجمالي الإيرادات. |

## 4. Privacy Policy §4 line (separate commit, for approval)

Added under §4 (cookies) in `content/legal/privacy.{ar,en}.md`. The policy
version stays `draft-2026-11-04`; the founder will bump it together with the
methodology session's Terms change, so users accept once. The SHA-256 pins in
`tests/legal-drafts.test.tsx` were updated to the new wording, in the same commit.

| Where | English | Arabic (proposed) |
| --- | --- | --- |
| Privacy §4 | Your recently viewed stocks are stored only in your browser and never sent to us; you can clear them at any time. | تُحفظ الأسهم التي شاهدتها مؤخرًا في متصفحك فقط ولا تُرسل إلينا أبدًا، ويمكنك مسحها في أي وقت. |

## Notes for review

- None of these strings uses "recommend", "advice", "buy" or "sell", or a
  ruling. The answer restates the stored status label and the reason it came from.
- The pass template adds «وفق المنهجية المختارة» / "under the selected methodology",
  so a pass reads as a methodology result, not a ruling.
- The link preview image uses only approved status labels and the «سهيل» wordmark.
