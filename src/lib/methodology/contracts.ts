import { z } from "zod";
import { criterionType, thresholdDirection, thresholdUnit } from "../../db/schema/core";
import { licensingStatus, methodologyType, officialOrInspired } from "../../db/schema/methodology";
import { evaluatorRegistry } from "../../engine/evaluators";
import type { Criterion, EngineInput, CriterionResultCode, Status } from "../../engine";
import { categories, lineItems, requiredInputs } from "./selectors";
export { categories, lineItems, requiredInputs } from "./selectors";
const nullableText = z.string().max(20000).nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {
  const d = new Date(s);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === s;
}, "Invalid calendar date").nullable();
export const metadataSchema = z.object({
  name: z.string().trim().min(1).max(500), short_label: nullableText,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200),
  type: z.enum(methodologyType.enumValues), publisher: nullableText,
  source_title: nullableText, source_url: z.url().nullable(),
  official_or_inspired: z.enum(officialOrInspired.enumValues),
  licensing_status: z.enum(licensingStatus.enumValues),
  verified_by: nullableText, verification_date: date, scope: nullableText, notes: nullableText,
}).strict();
export const versionSchema = z.object({
  version: z.string().trim().min(1).max(100), version_label: nullableText,
  effective_date: date, changelog: nullableText, notes: nullableText,
  purification_treatment: z.record(z.string(),z.json()).nullable(),
  is_public: z.boolean(),
}).strict();
export const criterionSchema = z.object({
  criterion_type: z.enum(criterionType.enumValues), label: z.string().trim().min(1).max(500),
  definition: nullableText, formula_text: nullableText, numerator_definition: nullableText,
  denominator_definition: nullableText,
  numerator_line_items: z.array(z.enum(lineItems)), denominator_line_items: z.array(z.enum(lineItems)),
  threshold: z.number().finite().nullable(), threshold_unit: z.enum(thresholdUnit.enumValues),
  threshold_direction: z.enum(thresholdDirection.enumValues),
  borderline_margin: z.number().finite().nonnegative().nullable(),
  treatment_rules: nullableText,
  treatment_rule_data: z.object({
    prohibited_categories: z.array(z.enum(categories)).optional(),
    non_permissible_categories: z.array(z.enum(categories)).optional(),
  }).strict().nullable(),
  edge_cases: nullableText, source_reference: nullableText, effective_date: date,
  sort_order: z.number().int().min(0), notes: nullableText,
}).strict().superRefine((c,ctx) => {
  const issue = (message:string) => ctx.addIssue({code:"custom",message});
  if(!evaluatorRegistry.has(c.criterion_type)) issue("No registered evaluator");
  if(!c.effective_date) issue("The evaluator requires a criterion effective date");
  if(new Set(c.numerator_line_items).size!==c.numerator_line_items.length || new Set(c.denominator_line_items).size!==c.denominator_line_items.length) issue("Duplicate line items would double-count evidence");
  if(c.threshold_direction !== "boolean" && c.threshold === null) issue("Threshold is required");
  const business = c.criterion_type === "business_activity";
  const revenue = c.criterion_type === "non_permissible_revenue";
  if(business && (c.threshold_direction !== "boolean" || c.threshold_unit !== "boolean")) issue("Business activity requires boolean direction and unit");
  if(!business && c.threshold_unit === "boolean" && c.threshold_direction !== "boolean") issue("A boolean unit requires boolean direction");
  if(!business && !revenue && (!c.numerator_line_items.length || !c.denominator_line_items.length)) issue("Ratio operands cannot be empty");
  if(!business && !revenue && [...c.numerator_line_items,...c.denominator_line_items].includes("business_segments")) issue("Ratios require financial line items");
  if(business && !c.treatment_rule_data?.prohibited_categories) issue("Prohibited categories are required");
  if(revenue && !c.treatment_rule_data?.non_permissible_categories) issue("Non-permissible categories are required");
  if(revenue && (c.threshold_unit !== "percent_of_total_revenue" || c.numerator_line_items.join() !== "business_segments" || c.denominator_line_items.join() !== "total_revenue")) issue("Revenue evaluator uses business_segments divided by total_revenue");
  if(business && (c.numerator_line_items.join() !== "business_segments" || c.denominator_line_items.length)) issue("Business activity uses business_segments only");
});
export type CriterionData = z.infer<typeof criterionSchema>;
export function engineCriterion(c: CriterionData & {id:string}): Criterion {
  return {
    id:c.id,criterionType:c.criterion_type,label:c.label,definition:c.definition??"",
    formulaText:c.formula_text??"",numeratorDefinition:c.numerator_definition??"",
    denominatorDefinition:c.denominator_definition??"",numeratorLineItems:c.numerator_line_items,
    denominatorLineItems:c.denominator_line_items,threshold:c.threshold,thresholdUnit:c.threshold_unit,
    thresholdDirection:c.threshold_direction,borderlineMargin:c.borderline_margin,
    treatmentRules:c.treatment_rules??"",treatmentRuleData:c.treatment_rule_data??{},
    edgeCases:c.edge_cases??"",requiredInputs:requiredInputs(c),sourceReference:c.source_reference??"",
    effectiveDate:c.effective_date??"",sortOrder:c.sort_order,notes:c.notes??"",
  };
}
export type AnalystCase = {
  name:string;
  inputs:Omit<EngineInput,"methodologyVersion"|"engineVersion"|"calculationVersion">;
  expected:{criteria:Record<string,CriterionResultCode>;status:Status};
};
// The engine validates detailed evidence contracts too; this schema prevents arbitrary
// candidate criteria/engine versions from being injected through saved cases.
export const analystCasesSchema = z.array(z.object({
  name:z.string().trim().min(1).max(300),
  inputs:z.object({
    securityId:z.string().min(1),asOf:z.string(),stalenessLimitDays:z.number().int().positive().optional(),
    period:z.object({id:z.string().min(1),label:z.string(),periodEnd:z.string()}).strict(),
    facts:z.array(z.object({
      lineItem:z.enum(lineItems),value:z.number().finite().nullable(),
      inputState:z.enum(["reported","derived","estimated","unknown"]),
      confidenceTier:z.enum(["Verified","Calculated","Estimated","AI Interpretation"]),sourceId:z.string(),
    }).strict()),
    segments:z.array(z.object({
      segmentName:z.string(),activityCategory:z.enum(categories),revenueAmount:z.number().finite().nullable(),
      revenueShare:z.number().min(0).max(1).nullable(),inputState:z.enum(["reported","derived","estimated","unknown"]),
      confidenceTier:z.enum(["Verified","Calculated","Estimated","AI Interpretation"]),sourceId:z.string(),
    }).strict()),
  }).strict(),
  expected:z.object({
    criteria:z.record(z.uuid(),z.enum(["pass","fail","borderline","unknown"])),
    status:z.enum(["passes_selected_methodology","fails_selected_methodology","requires_review","insufficient_data"]),
  }).strict(),
}).strict()).max(1000);
