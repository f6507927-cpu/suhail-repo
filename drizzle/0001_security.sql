-- D-15/16/74/77. Never put role passwords in a migration.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'suhail_public') THEN
    CREATE ROLE suhail_public NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'suhail_app') THEN
    CREATE ROLE suhail_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
--> statement-breakpoint
REVOKE ALL ON SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC, suhail_public, suhail_app;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO suhail_public, suhail_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app REVOKE ALL ON TABLES FROM PUBLIC, suhail_public, suhail_app;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA app REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','analyst_profile','audit_event','exchange','company','security','source',
    'financial_period','financial_fact','business_segment','price_bar','methodology',
    'methodology_version','methodology_criterion','methodology_version_report','screening_run',
    'screening_criterion_result','screening_unknown','explanation_object','edition','pick',
    'editorial_approval','edition_revision','editorial_setting','job_run'
  ] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS application_access ON app.%I', t);
    EXECUTE format('CREATE POLICY application_access ON app.%I TO suhail_app USING (true) WITH CHECK (true)', t);
    IF t = ANY (ARRAY['screening_run','screening_criterion_result','screening_unknown','explanation_object','audit_event','edition_revision','editorial_approval','methodology_version_report']) THEN
      EXECUTE format('GRANT SELECT, INSERT ON app.%I TO suhail_app', t);
    ELSE
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON app.%I TO suhail_app', t);
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
-- Explicit public allowlists. No table-wide SELECT, user IDs, notes, or emails.
GRANT SELECT (id,created_at,updated_at,is_demo,code,name,mic,country,region,timezone,default_currency,regulator,settlement_convention,is_active) ON app.exchange TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,name,name_ar,legal_name,country,domicile,description,description_ar,description_en,sector_label,industry_label,website,founded_year,fiscal_year_end,reporting_currency,sector_label_note) ON app.company TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,company_id,exchange_id,exchange_code,ticker,display_symbol,identifier_type,identifier_value,currency,instrument_type,listing_status,slug,in_universe,coverage_analyst_id,coverage_started_at,demo_label) ON app.security TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,label,source_type,provider,document_title,document_reference,source_url,retrieved_at,reporting_period,confidence_tier,is_synthetic) ON app.source TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,company_id,period_type,fiscal_year,fiscal_period_label,period_start,period_end,reported_date,currency,is_latest,filing_reference,source_id) ON app.financial_period TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,company_id,period_id,line_item,label,value,value_text,currency,unit_scale,input_state,confidence_tier,source_id,as_of_date,mapping_note,unknown_note,is_current) ON app.financial_fact TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,company_id,period_id,segment_name,description,activity_category,category_basis,revenue_amount,revenue_share,input_state,confidence_tier,source_id) ON app.business_segment TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,security_id,ticker,date,close,currency,week_index,advance_batch,is_synthetic,source_label) ON app.price_bar TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,name,slug,short_label,type,publisher,source_title,source_url,official_or_inspired,licensing_status,verified_by,verification_date,production_enabled,scope,current_version_label) ON app.methodology TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,methodology_id,methodology_name,version,version_label,effective_date,changelog,supersedes_version_id,created_by_name,production_enabled,workflow_status,purification_treatment,is_public,source_ids) ON app.methodology_version TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,methodology_id,methodology_version_id,criterion_type,label,definition,formula_text,numerator_definition,denominator_definition,numerator_line_items,denominator_line_items,threshold,threshold_unit,threshold_direction,borderline_margin,treatment_rules,treatment_rule_data,edge_cases,required_inputs,source_reference,effective_date,sort_order) ON app.methodology_criterion TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,security_id,company_id,exchange_code,ticker,company_name,methodology_id,methodology_name,methodology_version_id,methodology_version_label,financial_period_id,financial_period_label,financial_snapshot_id,calculation_version,data_adequacy,confidence,status,status_reasons,data_as_of,generated_at,immutable_hash,engine_version) ON app.screening_run TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,screening_run_id,criterion_id,criterion_type,criterion_label,result,numerator_value,numerator_definition,denominator_value,denominator_definition,ratio,threshold,threshold_unit,threshold_direction,borderline_margin,input_states,confidence_tier,source_ids,calculation_trace,result_reason,source_reference,sort_order) ON app.screening_criterion_result TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,screening_run_id,criterion_id,criterion_type,criterion_label,field_or_input,why_missing,effect,source_reference,severity) ON app.screening_unknown TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,screening_run_id,security_id,methodology_version_label,claim,evidence,unknowns,sources,methodology,allowed_numbers,allowed_tokens,ai_text,ai_model,prompt_version,validation_status,validation_details,generated_at) ON app.explanation_object TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,edition_id,week_start,week_end,status,demo_mode,demo_mode_reason,revision_number,market_timezone,market_cutoff_note,shariah_methodology_id,shariah_methodology_name,shariah_methodology_version_id,shariah_methodology_version_label,shariah_methodology_production_enabled,shariah_eligibility_rule,data_snapshot_date,calculation_version,source_ids,content_hash,generated_at,published_at,superseded_by_edition_id,disclaimer) ON app.edition TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,edition_id,edition_label,slot_key,slot_index,slot_label,pick_type,rank,security_id,ticker,display_symbol,company_name,sector_label,country,currency,market_cap_bucket,shariah_run_id,shariah_status,shariah_label,shariah_methodology_version_label,shariah_data_date,shariah_eligibility_note,unknowns,source_ids,data_as_of,editor_author,editor_thesis_ar,editor_thesis_en,editor_why_now_ar,editor_why_now_en,editor_evidence,risks_ar,risks_en,editor_valuation_context_ar,editor_valuation_context_en,editor_conflict_disclosure_ar,editor_conflict_disclosure_en,editor_published_at,ineligible_override,override_label,starting_price,starting_price_date,start_price_source,disclaimer) ON app.pick TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,edition_id,edition_label,revision_number,supersedes_revision_number,revision_type,reason,changes_summary,picks_added,picks_changed,picks_retained,content_hash) ON app.edition_revision TO suhail_public;
GRANT SELECT (id,created_at,updated_at,is_demo,name_ar,name_en,title_ar,title_en,credentials,headshot_object_key,bio_ar,bio_en,active) ON app.analyst_profile TO suhail_public;
--> statement-breakpoint
-- Nonrecursive graph: evidence -> securities/versions; source -> evidence.
-- No evidence policy queries source and no version policy queries methodology.
DROP POLICY IF EXISTS public_read ON app.exchange;
CREATE POLICY public_read ON app.exchange FOR SELECT TO suhail_public USING (true);
DROP POLICY IF EXISTS public_read ON app.security;
CREATE POLICY public_read ON app.security FOR SELECT TO suhail_public USING (in_universe AND listing_status = 'listed');
DROP POLICY IF EXISTS public_read ON app.company;
CREATE POLICY public_read ON app.company FOR SELECT TO suhail_public USING (EXISTS (SELECT 1 FROM app.security s WHERE s.company_id = company.id AND s.in_universe AND s.listing_status = 'listed'));
DROP POLICY IF EXISTS public_read ON app.methodology_version;
CREATE POLICY public_read ON app.methodology_version FOR SELECT TO suhail_public USING (is_public);
DROP POLICY IF EXISTS public_read ON app.methodology;
CREATE POLICY public_read ON app.methodology FOR SELECT TO suhail_public USING (EXISTS (SELECT 1 FROM app.methodology_version v WHERE v.methodology_id = methodology.id AND v.is_public));
DROP POLICY IF EXISTS public_read ON app.methodology_criterion;
CREATE POLICY public_read ON app.methodology_criterion FOR SELECT TO suhail_public USING (EXISTS (SELECT 1 FROM app.methodology_version v WHERE v.id = methodology_criterion.methodology_version_id AND v.is_public));
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['financial_period','financial_fact','business_segment'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS public_read ON app.%I', t);
    EXECUTE format('CREATE POLICY public_read ON app.%I FOR SELECT TO suhail_public USING (EXISTS (SELECT 1 FROM app.security s WHERE s.company_id = %I.company_id AND s.in_universe AND s.listing_status = ''listed''))', t, t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS public_read ON app.price_bar;
CREATE POLICY public_read ON app.price_bar FOR SELECT TO suhail_public USING (EXISTS (SELECT 1 FROM app.security s WHERE s.id = price_bar.security_id AND s.in_universe AND s.listing_status = 'listed'));
DROP POLICY IF EXISTS public_read ON app.screening_run;
CREATE POLICY public_read ON app.screening_run FOR SELECT TO suhail_public USING (
  EXISTS (SELECT 1 FROM app.security s WHERE s.id = screening_run.security_id AND s.in_universe AND s.listing_status = 'listed')
  AND EXISTS (SELECT 1 FROM app.methodology_version v WHERE v.id = screening_run.methodology_version_id AND v.is_public)
);
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['screening_criterion_result','screening_unknown','explanation_object'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS public_read ON app.%I', t);
    EXECUTE format('CREATE POLICY public_read ON app.%I FOR SELECT TO suhail_public USING (EXISTS (SELECT 1 FROM app.screening_run r WHERE r.id = %I.screening_run_id))', t, t);
  END LOOP;
END $$;
--> statement-breakpoint
DROP POLICY IF EXISTS public_read ON app.edition;
CREATE POLICY public_read ON app.edition FOR SELECT TO suhail_public USING (status IN ('published_demo','published_live'));
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pick','edition_revision'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS public_read ON app.%I', t);
    EXECUTE format('CREATE POLICY public_read ON app.%I FOR SELECT TO suhail_public USING (EXISTS (SELECT 1 FROM app.edition e WHERE e.id = %I.edition_id AND e.status IN (''published_demo'',''published_live'')))', t, t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS public_read ON app.analyst_profile;
CREATE POLICY public_read ON app.analyst_profile FOR SELECT TO suhail_public USING (active);
DROP POLICY IF EXISTS public_read ON app.source;
CREATE POLICY public_read ON app.source FOR SELECT TO suhail_public USING (
  EXISTS (SELECT 1 FROM app.financial_fact f WHERE f.source_id = source.id)
  OR EXISTS (SELECT 1 FROM app.financial_period p WHERE p.source_id = source.id)
  OR EXISTS (SELECT 1 FROM app.business_segment b WHERE b.source_id = source.id)
  OR EXISTS (SELECT 1 FROM app.screening_criterion_result c WHERE c.source_ids @> ARRAY[source.id])
  OR EXISTS (SELECT 1 FROM app.pick p WHERE p.source_ids @> ARRAY[source.id]
    OR p.editor_evidence @> jsonb_build_array(jsonb_build_object('source_id', source.id::text)))
  OR EXISTS (SELECT 1 FROM app.methodology_version v WHERE v.is_public AND v.source_ids @> ARRAY[source.id])
);
--> statement-breakpoint
-- Owner executes the view so its one column works despite direct table denial.
CREATE OR REPLACE VIEW app.public_settings WITH (security_barrier = true) AS
  SELECT default_shariah_methodology_version_id FROM app.editorial_setting WHERE setting_key = 'editorial';
ALTER VIEW app.public_settings OWNER TO postgres;
REVOKE ALL ON app.public_settings FROM PUBLIC;
GRANT SELECT ON app.public_settings TO suhail_public, suhail_app;