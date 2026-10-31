# Public UI label approval request

Status: **Approved under D-130, with the founder's edits below recorded before
runtime application.** The tables preserve the reviewed drafts; the amendment
table is authoritative wherever it differs.
This batch does not approve legal text, screening templates, methodology content,
production enablement, or the separate broad Arabic-copy review.

## Existing-copy reuse

Reuse verified wording from the existing dictionaries and D-96/D-101/D-107
approval records wherever the meaning is identical. In particular, reuse the
approved methodology field labels, breadcrumb labels, home/recovery controls,
and existing screening-status labels. A confidence tier's “Verified” describes
evidence quality, not successful authenticator verification; do not reuse that
authentication translation for the tier.

## Proposed missing display labels

Each row is an explicit mapping, not permission to translate arbitrary stored
text. English is also the proposed readable English display value.

| Family / stored value | English display | Arabic draft — ⟦AR-REVIEW⟧ |
| --- | --- | --- |
| criterion result: pass | Pass | اجتاز المعيار |
| criterion result: borderline | Borderline | نتيجة حدية |
| criterion result: fail | Fail | لم يجتز المعيار |
| criterion result / input state: unknown | Unknown | غير معروف |
| confidence: High | High | مرتفعة |
| confidence: Medium | Medium | متوسطة |
| confidence: Low | Low | منخفضة |
| evidence tier: Verified | Verified evidence | بيانات متحقق منها |
| evidence tier: Calculated | Calculated | محسوبة |
| evidence tier: Estimated | Estimated | تقديرية |
| evidence tier: AI Interpretation | AI interpretation | تفسير بالذكاء الاصطناعي |
| input state: reported | Reported | مُفصح عنها |
| input state: derived | Derived | مشتقة |
| input state: estimated | Estimated | تقديرية |
| input state: missing | Missing | مفقودة |
| adequacy: adequate | Adequate | كافية |
| adequacy: adequate_with_estimates | Adequate with estimates | كافية مع تقديرات |
| adequacy: inadequate | Inadequate | غير كافية |
| source: annual_report | Annual report | تقرير سنوي |
| source: interim_report | Interim report | تقرير مرحلي |
| source: regulatory_filing | Regulatory filing | إفصاح للجهة التنظيمية |
| source: investor_relations | Investor relations | علاقات المستثمرين |
| source: market_data | Market data | بيانات السوق |
| source: data_provider | Data provider | مزوّد بيانات |
| source: methodology_document | Methodology document | وثيقة المنهجية |
| source: company_website | Company website | موقع الشركة |
| source: news | News | أخبار |
| source / licence: internal | Internal | داخلي |
| scale: absolute | Unscaled | دون مضاعف |
| scale: thousands | Thousands | آلاف |
| scale: millions | Millions | ملايين |
| scale: billions | Billions | مليارات |
| unit: shares | Shares | أسهم |
| unit: percent | Percent | نسبة مئوية |
| unit: boolean | Yes / no | نعم / لا |
| boolean value: true | Yes | نعم |
| boolean value: false | No | لا |
| threshold: percent_of_total_revenue | Percent of total revenue | نسبة من إجمالي الإيرادات |
| threshold: percent_of_total_assets | Percent of total assets | نسبة من إجمالي الأصول |
| threshold: percent_of_market_cap | Percent of market capitalization | نسبة من القيمة السوقية |
| threshold: absolute | Absolute value | قيمة مطلقة |
| direction: max | Maximum | الحد الأقصى |
| direction: min | Minimum | الحد الأدنى |
| line item: total_revenue | Total revenue | إجمالي الإيرادات |
| line item: prohibited_income | Prohibited income | الدخل غير المباح |
| line item: total_assets | Total assets | إجمالي الأصول |
| line item: total_equity | Total equity | إجمالي حقوق الملكية |
| line item: interest_bearing_debt | Interest-bearing debt | الديون التي تترتب عليها فوائد |
| line item: finance_lease_liabilities | Finance lease liabilities | التزامات الإيجار التمويلي |
| line item: operating_lease_liabilities | Operating lease liabilities | التزامات الإيجار التشغيلي |
| line item: cash_and_equivalents | Cash and cash equivalents | النقد وما في حكمه |
| line item: interest_bearing_investments | Interest-bearing investments | استثمارات تدرّ فوائد |
| line item: accounts_receivable | Accounts receivable | الذمم المدينة |
| line item: net_income | Net income | صافي الدخل |
| line item: operating_cash_flow | Operating cash flow | التدفق النقدي التشغيلي |
| line item: shares_outstanding | Shares outstanding | الأسهم القائمة |
| line item: market_cap | Market capitalization | القيمة السوقية |
| line item: market_value_basis | Market value basis | أساس القيمة السوقية |
| licence: licensed | Licensed | مرخّص |
| licence: public_document | Public document | وثيقة متاحة للعموم |
| licence: unlicensed_adapted | Adapted without a licence | مُكيّف دون ترخيص |
| methodology source: official | Official | رسمي |
| methodology source: adapted | Adapted | مُكيّف |
| methodology source: internal_example | Internal example | مثال داخلي |
| methodology type: equity_screening | Equity screening | فحص الأسهم |
| methodology type: fund_screening | Fund screening | فحص الصناديق |
| methodology type: portfolio_screening | Portfolio screening | فحص المحافظ |
| workflow: draft | Draft | مسودة |
| workflow: source_verified | Source verified | تم التحقق من المصدر |
| workflow: rules_normalized | Rules normalized | تم توحيد صياغة القواعد |
| workflow: tests_passed | Tests passed | اجتازت الاختبارات |
| workflow: universe_tested | Universe tested | تم اختبار نطاق الأوراق المالية |
| workflow: human_reviewed | Human reviewed | تمت المراجعة البشرية |
| workflow: approved | Approved | موافَق عليه |
| workflow: production | Production | مُعتمد للاستخدام الفعلي |
| severity: blocking | Blocking | مانع |
| severity: review | Review | للمراجعة |
| severity: informational | Informational | للمعلومات |
| criterion type: business_activity | Business activity | نشاط الشركة |
| criterion type: non_permissible_revenue | Non-permissible revenue | الإيرادات غير المباحة |
| criterion type: cash_and_investments | Cash and investments | النقد والاستثمارات |
| criterion type: receivables | Receivables | الذمم المدينة |
| criterion type: custom_ratio | Custom ratio | نسبة مخصّصة |

Identifiers, currency codes, exchange names/codes, ticker symbols, accession
numbers, periods, version strings and numeric evidence remain unchanged and
bidi-isolated; they are not translation gaps or narrative-language notices.

## New or missing UI text needed for this repair

| Context | English | Arabic draft — ⟦AR-REVIEW⟧ |
| --- | --- | --- |
| Section-level fallback notice | English only | متاح بالإنجليزية فقط |
| Reverse fallback notice | Arabic only | متاح بالعربية فقط |
| Passing stock, empty status reasons | All recorded criteria passed. No additional status reasons were recorded. | اجتازت جميع المعايير المسجلة الفحص. لم تُسجّل أسباب إضافية للنتيجة. |
| Other result, empty status reasons | No specific status reasons were recorded. | لم تُسجّل أسباب محددة للنتيجة. |
| Unknown enum/key fallback | Unrecognized label | تسمية غير معروفة |
| Header search placeholder; search input label | Ticker or company name | رمز السهم أو اسم الشركة |
| Search result, no stored run | Not screened yet | لم يُفحص بعد |
| Global 404 title and heading | Page not found | الصفحة غير موجودة |
| Evidence field | Confidence tier | فئة جودة البيانات |
| Evidence field | Input state | حالة المدخلات |
| Evidence field | Data adequacy | كفاية البيانات |
| Evidence field | Result | النتيجة |
| Evidence section | Fundamentals | البيانات المالية الأساسية |
| Evidence field | Unit | الوحدة |
| Calculation control | Show calculation | عرض الحساب |
| Stored evidence | Calculation | الحساب |
| Structured evidence key | Field | الحقل |
| Structured evidence key | Claim | البيان |
| Structured evidence key | Reason | السبب |
| Structured evidence key | Input | المدخل |
| Structured evidence key | Inputs | المدخلات |
| Structured evidence key | Definition | التعريف |
| Structured evidence key | Amount | المبلغ |
| Structured evidence key | Count | العدد |

Other structured keys must first reuse approved semantically matching labels.
Unexpected keys must use the approved generic unknown-label fallback, not expose
raw snake_case as a display label or silently imply a new translation.

## Baseline and caller inventory

- Stock presentation: `StockVerdict.tsx`, `StockVerdictParts.tsx`, and their CSS.
  The current stock phrase registry has 97 entries (93 distinct phrases);
  only “Not recorded” resolves through the approved phrase map. Some other
  phrases can reuse approved message keys rather than require new wording.
  Registry entries are not a visible marker count.
- Search: `SiteHeader.tsx`, `StockSearchForm.tsx`, `SearchResults.tsx`.
  All eight `publicSearch` Arabic message entries currently carry review markers,
  including “Search”, whose approved wording can be reused.
- Methodology: public detail/copy, admin management, criteria, reports,
  breadcrumbs. Raw licensing, source, workflow and type values need mappings.
- Shell/recovery: public layout, disclaimer callers, account footer, global
  recovery document. Recovery must remain provider-independent and request-free.
- Private navigation: auth, consent, admin and MFA screens. MFA will reuse the
  existing approved public-home link; no new cancellation wording is needed.
- Financial admin: remove the matching decorative card layer, preserving
  functional dialog backdrops.

Visible review-marker counts at 390px and 1366px are not yet measured; the browser
baseline and final matrix remain pending. Do not substitute source counts for
visible browser counts or declare any pending row translated.

## Approval scope

An explicit approval of this named batch authorizes only the exact Arabic values
in the two tables. Edits to individual rows must be recorded before application.
Existing approved wording takes precedence when a matching approved label
already exists. Remaining unrelated review copy stays marked and inventoried.

## Founder approval and exact amendments (D-130)

The founder approved every other row exactly as drafted and requested the
following replacements, recorded before applying any runtime copy:

| Row | Exact approved Arabic |
| --- | --- |
| input state: missing | غير متوفرة |
| source: regulatory_filing | إفصاح تنظيمي |
| scale: absolute | بالقيمة الكاملة |
| line item: interest_bearing_debt | الديون بفوائد |
| line item: interest_bearing_investments | الاستثمارات بفوائد |
| line item: prohibited_income | الإيرادات غير المباحة |
| methodology source: adapted | مُعدّل |
| licence: unlicensed_adapted | مُعدّل دون ترخيص |
| existing officialOrAdapted label (both callers) | رسمي أو مُعدّل |
| Passing stock, empty status reasons | اجتاز السهم جميع المعايير المسجلة. لم تُسجّل أسباب إضافية. |
| retainedEvidence (batch 2 correction) | القيم غير المعروفة ومدخلات الأدلة المحفوظة |
| sharedGoldenRegressions (batch 2 correction) | حالات الاختبار المرجعية المشتركة |
| methodologies.subtitle (batch 2 correction) | كل قاعدة يطبّقها سهيل، مع مرجع مصدرها وإصدارها وحالة التحقق منها. |
| coverageGaps (batch 2 correction) | المعايير التي تنقصها تغطية |
| requiredInputsDerived (batch 2 correction) | المدخلات المطلوبة · تُحدَّد تلقائيًا |
| purificationHelp (batch 2 correction) | اترك الحقل فارغًا إذا لم يحدد هذا الإصدار بيانات تطهير. أدخل كائن JSON فقط إذا كان الإصدار يحدد بيانات معالجة محفوظة. لا تُطبّق صيغة عامة. |

“Adapted” uses **مُعدّل** consistently in this batch. “Prohibited income” uses
**الإيرادات غير المباحة**, not “الدخل”. Preserve code isolation for the literal
JSON identifier in the final applied value, as required by D-107.

The historical batch-2 fixture retains its original drafts and approval record;
the new amendment tests must explicitly cover the D-130 overrides rather than
silently rewriting the earlier approval history.

## Supplemental inventory — approved as written (D-131)

The complete methodology editor selector inventory includes four additional
fundamental/input keys and nineteen activity categories that were absent from
the first review table. The activity options must remain distinguishable, not
all display the generic unknown-label fallback. The founder explicitly approved
all 23 rows as written. D-131 records this approval before runtime application.
The “draft” column heading below preserves the wording of the submitted batch.

| Stored value | English display | Arabic draft — ⟦AR-REVIEW⟧ |
| --- | --- | --- |
| ebitda | Earnings before interest, taxes, depreciation and amortization | الأرباح قبل الفوائد والضرائب والإهلاك والاستهلاك |
| prior_year_revenue | Prior-year revenue | إيرادات السنة السابقة |
| prior_year_net_income | Prior-year net income | صافي دخل السنة السابقة |
| business_segments | Business segments | قطاعات الأعمال |
| conventional_finance | Conventional finance | التمويل التقليدي |
| interest_based_lending | Interest-based lending | الإقراض بفوائد |
| insurance_conventional | Conventional insurance | التأمين التقليدي |
| alcohol | Alcohol | الكحول |
| tobacco | Tobacco | التبغ |
| gambling | Gambling | القمار |
| adult_entertainment | Adult entertainment | الترفيه للبالغين |
| pork_related | Pork-related activities | الأنشطة المتعلقة بلحم الخنزير |
| conventional_media | Conventional media | الإعلام التقليدي |
| weapons_conventional | Conventional weapons | الأسلحة التقليدية |
| generic_permissible | Other permissible activities | أنشطة مباحة أخرى |
| real_estate_permissible | Permissible real estate | العقارات المباحة |
| technology | Technology | التقنية |
| healthcare | Healthcare | الرعاية الصحية |
| retail_permissible | Permissible retail | تجارة التجزئة المباحة |
| industrials | Industrials | الأنشطة الصناعية |
| energy | Energy | الطاقة |
| telecom | Telecommunications | الاتصالات |
| unclassified | Unclassified | غير مصنّف |

These are display labels for existing stored categories, not approval of an
issuer classification, screening rule, threshold, or methodology.
