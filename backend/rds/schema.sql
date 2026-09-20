-- Consolidated schema for RDS PostgreSQL 18.3
-- Generated from a pg_dump --schema-only of the LIVE Supabase database
-- (PostgreSQL 17.6, project ufkrfrmqangydrjbzljo), not from the repo's
-- migration files - those reproduce only 37 of the 48 live tables.
--
-- Supabase-specific constructs removed (see [ported] markers inline):
--   psql meta-commands : 2
--   auth.users FKs     : 1
--   RLS enables        : 43
--   deny-all policies  : 43
--
-- gen_random_uuid() is retained: built into PostgreSQL 13+, so no pgcrypto.

--
-- PostgreSQL database dump
--



-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- [ported] reset: drops the partial 37-table schema left by the migration replay
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;


--
-- Name: assignment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.assignment_status AS ENUM (
    'active',
    'completed',
    'pending',
    'terminated'
);


--
-- Name: billing_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.billing_type AS ENUM (
    'hourly',
    'monthly',
    'milestone'
);


--
-- Name: case_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.case_status AS ENUM (
    'open',
    'pending_uscis',
    'rfe_received',
    'case_approved',
    'denied',
    'closed'
);


--
-- Name: case_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.case_type AS ENUM (
    'h1b_new',
    'h1b_extension',
    'h1b_transfer',
    'perm_green_card',
    'opt_stem_extension',
    'tn_renewal',
    'l1_extension',
    'other'
);


--
-- Name: e_verify_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.e_verify_status AS ENUM (
    'not_started',
    'pending',
    'employment_authorized',
    'tentative_nonconfirmation',
    'case_closed'
);


--
-- Name: employee_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employee_status AS ENUM (
    'active',
    'inactive',
    'onboarding'
);


--
-- Name: employment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employment_type AS ENUM (
    'full_time',
    'part_time',
    'contract',
    'w2',
    '1099',
    'c2c',
    'vendor'
);


--
-- Name: entity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.entity_type AS ENUM (
    'employee',
    'client',
    'invoice',
    'case'
);


--
-- Name: filing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.filing_status AS ENUM (
    'draft',
    'filed',
    'certified',
    'selected',
    'not_selected',
    'denied',
    'withdrawn'
);


--
-- Name: filing_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.filing_type AS ENUM (
    'cap_registration',
    'pwd'
);


--
-- Name: i9_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.i9_status AS ENUM (
    'pending',
    'complete',
    'expired'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'sent',
    'paid',
    'overdue',
    'viewed',
    'partially_paid'
);


--
-- Name: leave_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.leave_request_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'cancelled'
);


--
-- Name: monthly_timesheet_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.monthly_timesheet_status AS ENUM (
    'draft',
    'submitted',
    'approved',
    'rejected'
);


--
-- Name: pay_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.pay_type AS ENUM (
    'hourly',
    'salary'
);


--
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_status AS ENUM (
    'new',
    'in_progress',
    'resolved'
);


--
-- Name: timesheet_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.timesheet_status AS ENUM (
    'draft',
    'submitted',
    'manager_approved',
    'client_approved',
    'rejected'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'hr',
    'operations',
    'finance',
    'employee',
    'legal'
);


--
-- Name: visa_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visa_type AS ENUM (
    'h1b',
    'l1',
    'opt',
    'stem_opt',
    'tn',
    'gc',
    'citizen',
    'other'
);


--
-- Name: generate_display_id(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_display_id(prefix text, seq_name text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  RETURN prefix || LPAD(nextval(seq_name)::TEXT, 4, '0');
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'pg_catalog', 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    entity_label text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: announcement_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcement_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('ANN-'::text, 'announcement_seq'::text) NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    target_roles text[] DEFAULT '{}'::text[] NOT NULL,
    author_id uuid,
    expires_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT announcements_type_check CHECK ((type = ANY (ARRAY['info'::text, 'urgent'::text, 'event'::text, 'policy'::text])))
);


--
-- Name: asset_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.asset_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('AST-'::text, 'asset_seq'::text) NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    brand text,
    model text,
    serial_number text,
    condition text DEFAULT 'good'::text NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    purchase_date date,
    purchase_price numeric(12,2),
    warranty_expiry date,
    notes text,
    assigned_to uuid,
    assigned_at timestamp with time zone,
    assigned_by uuid,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT assets_category_check CHECK ((category = ANY (ARRAY['laptop'::text, 'desktop'::text, 'monitor'::text, 'phone'::text, 'tablet'::text, 'badge'::text, 'vehicle'::text, 'software_license'::text, 'other'::text]))),
    CONSTRAINT assets_condition_check CHECK ((condition = ANY (ARRAY['new'::text, 'good'::text, 'fair'::text, 'poor'::text, 'damaged'::text]))),
    CONSTRAINT assets_status_check CHECK ((status = ANY (ARRAY['available'::text, 'assigned'::text, 'maintenance'::text, 'retired'::text, 'lost'::text])))
);


--
-- Name: assignment_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assignment_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('ASN-'::text, 'assignment_seq'::text) NOT NULL,
    employee_id uuid NOT NULL,
    client_id uuid NOT NULL,
    project_name text NOT NULL,
    role text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    bill_rate numeric(10,2) DEFAULT 0 NOT NULL,
    pay_rate numeric(10,2) DEFAULT 0 NOT NULL,
    max_hours_per_week integer DEFAULT 40 NOT NULL,
    status public.assignment_status DEFAULT 'pending'::public.assignment_status NOT NULL,
    billing_type public.billing_type,
    work_location text,
    reporting_manager_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid,
    notes text
);


--
-- Name: case_filings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_filings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('FIL-'::text, 'filing_seq'::text) NOT NULL,
    case_id uuid NOT NULL,
    filing_type public.filing_type NOT NULL,
    status public.filing_status DEFAULT 'draft'::public.filing_status NOT NULL,
    reference_number text,
    filed_date date,
    decision_date date,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    deleted_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: case_message_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_message_reads (
    message_id uuid NOT NULL,
    user_id uuid NOT NULL,
    read_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: case_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    body text NOT NULL,
    author_id uuid,
    audience text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT case_messages_audience_check CHECK ((audience = ANY (ARRAY['all'::text, 'law_firm'::text, 'beneficiary'::text])))
);


--
-- Name: case_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    body text NOT NULL,
    author_id uuid,
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    title text,
    tagged_to uuid,
    status text,
    access_level text
);


--
-- Name: case_perm_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_perm_details (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    job_title text,
    full_time_position boolean,
    work_hours_per_week numeric,
    wage_rate numeric(12,2),
    soc_code text,
    pay_frequency text,
    classification text,
    permanent_position boolean,
    experience_required boolean,
    months_of_experience integer,
    work_address text,
    minimum_education text,
    major_field_of_study text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: case_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.case_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: case_status_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_status_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    step_key text NOT NULL,
    step_order integer NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: case_tax_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_tax_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    tax_year integer NOT NULL,
    amount numeric(12,2),
    document_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: case_wages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_wages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    wage_year integer NOT NULL,
    salary_received numeric(12,2),
    document_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('CASE-'::text, 'case_seq'::text) NOT NULL,
    employee_id uuid NOT NULL,
    case_type public.case_type NOT NULL,
    status public.case_status DEFAULT 'open'::public.case_status NOT NULL,
    receipt_number text,
    priority_date date,
    filed_date date,
    decision_date date,
    attorney_name text,
    description text DEFAULT ''::text NOT NULL,
    deleted_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    petitioner_id uuid,
    classification text
);


--
-- Name: client_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.client_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('CLT-'::text, 'client_seq'::text) NOT NULL,
    company_name text NOT NULL,
    contact_name text NOT NULL,
    contact_email text NOT NULL,
    contact_phone text,
    industry text DEFAULT ''::text NOT NULL,
    address_street text DEFAULT ''::text NOT NULL,
    address_city text DEFAULT ''::text NOT NULL,
    address_state text DEFAULT ''::text NOT NULL,
    address_zip text DEFAULT ''::text NOT NULL,
    address_country text DEFAULT 'US'::text NOT NULL,
    contract_start_date date NOT NULL,
    contract_end_date date,
    net_payment_days integer DEFAULT 30 NOT NULL,
    default_bill_rate numeric(10,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    billing_type public.billing_type,
    billing_contact_name text,
    billing_contact_email text,
    billing_contact_phone text,
    billing_street text,
    billing_city text,
    billing_state text,
    billing_zip text,
    billing_country text,
    tax_id text,
    status text DEFAULT 'active'::text NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    onboarding_status text DEFAULT 'not_started'::text NOT NULL,
    internal_notes text,
    CONSTRAINT clients_onboarding_status_check CHECK ((onboarding_status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text]))),
    CONSTRAINT clients_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: company_holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_holidays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    date date NOT NULL,
    is_recurring boolean DEFAULT false NOT NULL,
    country_code text DEFAULT 'US'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: department_budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    department text NOT NULL,
    fiscal_year integer NOT NULL,
    budget_type text DEFAULT 'opex'::text NOT NULL,
    budget_amount numeric(15,2) NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT department_budgets_budget_type_check CHECK ((budget_type = ANY (ARRAY['headcount'::text, 'opex'::text, 'capex'::text])))
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type public.entity_type NOT NULL,
    entity_id uuid NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    storage_path text NOT NULL,
    storage_url text,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    expiry_date date,
    legal_flagged boolean DEFAULT false NOT NULL,
    legal_flag_comment text,
    category text
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    subject text DEFAULT ''::text NOT NULL,
    header_html text DEFAULT ''::text NOT NULL,
    body_html text DEFAULT ''::text NOT NULL,
    footer_html text DEFAULT ''::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    type text DEFAULT 'general'::text NOT NULL,
    CONSTRAINT email_templates_type_check CHECK ((type = ANY (ARRAY['general'::text, 'invoice'::text])))
);


--
-- Name: employee_leave_entitlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_leave_entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    leave_type_id uuid NOT NULL,
    year integer NOT NULL,
    granted_days numeric(5,2) NOT NULL,
    carried_over numeric(5,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_onboarding_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_onboarding_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    template_id uuid,
    title text NOT NULL,
    description text,
    category text DEFAULT 'general'::text NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    completed_by uuid,
    completed_at timestamp with time zone,
    notes text,
    due_date date,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    skill_name text NOT NULL,
    proficiency text DEFAULT 'intermediate'::text NOT NULL,
    last_used_year integer,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_skills_proficiency_check CHECK ((proficiency = ANY (ARRAY['beginner'::text, 'intermediate'::text, 'advanced'::text, 'expert'::text])))
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('EMP-'::text, 'employee_seq'::text) NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    dob date,
    address_street text DEFAULT ''::text NOT NULL,
    address_city text DEFAULT ''::text NOT NULL,
    address_state text DEFAULT ''::text NOT NULL,
    address_zip text DEFAULT ''::text NOT NULL,
    address_country text DEFAULT 'US'::text NOT NULL,
    department text NOT NULL,
    job_title text NOT NULL,
    employment_type public.employment_type DEFAULT 'contract'::public.employment_type NOT NULL,
    start_date date NOT NULL,
    status public.employee_status DEFAULT 'onboarding'::public.employee_status NOT NULL,
    visa_type public.visa_type,
    visa_expiry date,
    i9_status public.i9_status,
    pay_rate numeric(10,2) DEFAULT 0 NOT NULL,
    pay_type public.pay_type DEFAULT 'hourly'::public.pay_type NOT NULL,
    work_location text,
    ssn text,
    payment_type text,
    bank_name text,
    bank_routing_number text,
    bank_account_number text,
    tax_form_type text,
    reporting_manager_id uuid,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    work_email text,
    middle_name text,
    gender text,
    marital_status text,
    nationality text,
    preferred_language text,
    languages_known text,
    profile_photo_url text,
    alt_phone text,
    linkedin_url text,
    skype_id text,
    permanent_address_street text,
    permanent_address_city text,
    permanent_address_state text,
    permanent_address_zip text,
    permanent_address_country text,
    emergency_contact_name text,
    emergency_contact_relationship text,
    emergency_contact_phone text,
    emergency_contact_alt_phone text,
    emergency_contact_address text,
    education jsonb DEFAULT '[]'::jsonb NOT NULL,
    work_history jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_experience_years numeric(4,1),
    experience_level text,
    blood_group text,
    identity_documents jsonb DEFAULT '[]'::jsonb NOT NULL,
    onboarding_completed_at timestamp with time zone,
    onboarding_change_request_message text,
    onboarding_change_requested_at timestamp with time zone,
    onboarding_change_requested_by uuid,
    leave_started_at date,
    leave_return_date date,
    leave_reason text,
    terminated_at date,
    termination_reason text,
    created_by uuid,
    onboarding_section_notes jsonb DEFAULT '{}'::jsonb,
    probation_end_date date,
    block_personal_email boolean DEFAULT false NOT NULL,
    emergency_contact_city text,
    emergency_contact_state text,
    emergency_contact_zip text,
    e_verify_status public.e_verify_status,
    e_verify_case_number text,
    dependents jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: enrollment_form_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.enrollment_form_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enrollment_forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrollment_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('ENR-'::text, 'enrollment_form_seq'::text) NOT NULL,
    employee_id uuid NOT NULL,
    created_by uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    form_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    submitted_at timestamp with time zone,
    pdf_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT enrollment_forms_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text])))
);


--
-- Name: expense_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('EXP-'::text, 'expense_seq'::text) NOT NULL,
    employee_id uuid NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    expense_date date NOT NULL,
    notes text,
    receipt_url text,
    status text DEFAULT 'draft'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    rejection_reason text,
    paid_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT expense_reports_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT expense_reports_category_check CHECK ((category = ANY (ARRAY['travel'::text, 'meals'::text, 'accommodation'::text, 'office_supplies'::text, 'equipment'::text, 'training'::text, 'other'::text]))),
    CONSTRAINT expense_reports_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text, 'paid'::text])))
);


--
-- Name: expense_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expense_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: filing_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.filing_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_line_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_line_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    timesheet_id uuid,
    employee_id uuid,
    description text NOT NULL,
    hours numeric(6,2) DEFAULT 0 NOT NULL,
    bill_rate numeric(10,2) DEFAULT 0 NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    item_name text,
    product_id uuid,
    quantity numeric(10,2)
);


--
-- Name: invoice_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoice_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoice_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    accent_color text DEFAULT '#2563EB'::text NOT NULL,
    font_family text DEFAULT 'Helvetica'::text NOT NULL,
    header_style text DEFAULT 'plain'::text NOT NULL,
    footer_text text DEFAULT 'Jobly Solutions · billing@joblysolutions.com · www.joblysolutions.com'::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoice_timesheets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_timesheets (
    invoice_id uuid NOT NULL,
    timesheet_id uuid NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_number text NOT NULL,
    client_id uuid NOT NULL,
    issue_date date NOT NULL,
    due_date date NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(5,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    status public.invoice_status DEFAULT 'draft'::public.invoice_status NOT NULL,
    pdf_url text,
    paid_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    billing_period_start date,
    billing_period_end date,
    po_number text,
    payment_terms text DEFAULT 'net_30'::text NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    viewed_at timestamp with time zone,
    public_token text DEFAULT (gen_random_uuid())::text,
    terms text,
    doc_type text DEFAULT 'invoice'::text NOT NULL,
    estimate_status text,
    converted_invoice_id uuid,
    recurring_template_id uuid,
    last_reminder_at timestamp with time zone,
    discount_type text,
    discount_value numeric(12,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    invoice_template_id uuid,
    created_by uuid,
    email_template_id uuid,
    CONSTRAINT chk_invoices_discount_type CHECK (((discount_type IS NULL) OR (discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text]))))
);


--
-- Name: leave_request_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_request_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('LV-'::text, 'leave_request_seq'::text) NOT NULL,
    employee_id uuid NOT NULL,
    leave_type text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_requested integer DEFAULT 0 NOT NULL,
    reason text,
    status public.leave_request_status DEFAULT 'pending'::public.leave_request_status NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT leave_requests_check CHECK ((end_date >= start_date)),
    CONSTRAINT leave_requests_leave_type_check CHECK ((leave_type = ANY (ARRAY['medical_leave'::text, 'sick'::text, 'vacation'::text, 'unpaid_leave'::text, 'bereavement'::text, 'jury_duty'::text, 'other'::text])))
);


--
-- Name: leave_type_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_type_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('LT-'::text, 'leave_type_seq'::text) NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    accrual_type text DEFAULT 'fixed'::text NOT NULL,
    default_days numeric(5,2) DEFAULT 0 NOT NULL,
    accrual_rate numeric(5,2),
    max_carryover numeric(5,2) DEFAULT 0,
    color text DEFAULT '#6366f1'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT leave_types_accrual_type_check CHECK ((accrual_type = ANY (ARRAY['fixed'::text, 'accrual'::text])))
);


--
-- Name: monthly_timesheet_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.monthly_timesheet_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: monthly_timesheets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_timesheets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('MTS-'::text, 'monthly_timesheet_seq'::text) NOT NULL,
    employee_id uuid NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    entries jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_hours numeric(7,2) DEFAULT 0 NOT NULL,
    expected_hours numeric(7,2) DEFAULT 0 NOT NULL,
    working_days integer DEFAULT 0 NOT NULL,
    leave_days integer DEFAULT 0 NOT NULL,
    status public.monthly_timesheet_status DEFAULT 'draft'::public.monthly_timesheet_status NOT NULL,
    notes text,
    rejection_reason text,
    pdf_url text,
    submitted_at timestamp with time zone,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    leave_reason text,
    client_signed_url text,
    client_signed_filename text,
    hr_notes text,
    CONSTRAINT monthly_timesheets_month_check CHECK (((month >= 1) AND (month <= 12)))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    title text NOT NULL,
    message text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    entity_type text,
    entity_id uuid,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_read boolean DEFAULT false NOT NULL,
    link text
);


--
-- Name: offboarding_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offboarding_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    template_id uuid,
    title text NOT NULL,
    description text,
    category text DEFAULT 'general'::text NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    completed_by uuid,
    completed_at timestamp with time zone,
    notes text,
    due_date date,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: offboarding_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offboarding_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    category text DEFAULT 'general'::text NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT offboarding_templates_category_check CHECK ((category = ANY (ARRAY['it'::text, 'hr'::text, 'compliance'::text, 'equipment'::text, 'finance'::text, 'general'::text])))
);


--
-- Name: onboarding_change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_change_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    message text NOT NULL,
    requested_by uuid,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone
);


--
-- Name: onboarding_checklist_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_checklist_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    category text DEFAULT 'general'::text NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT onboarding_checklist_templates_category_check CHECK ((category = ANY (ARRAY['it'::text, 'hr'::text, 'compliance'::text, 'equipment'::text, 'finance'::text, 'general'::text])))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    invoice_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    paid_on date NOT NULL,
    method text DEFAULT 'bank_transfer'::text NOT NULL,
    reference text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: performance_review_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.performance_review_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: performance_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('PR-'::text, 'performance_review_seq'::text) NOT NULL,
    employee_id uuid NOT NULL,
    created_by uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    salutation text,
    employee_number text,
    title_payroll_title text,
    employee_type text,
    supervisor_name text,
    supervised_full_period boolean DEFAULT true NOT NULL,
    supervised_months integer,
    job_related_performance text,
    overall_evaluation text,
    ratings jsonb DEFAULT '{}'::jsonb NOT NULL,
    job_function text,
    weight_percent numeric(5,2) DEFAULT 100,
    status_goal text,
    complete_percent numeric(5,2) DEFAULT 100,
    performance_evaluation text,
    future_goals text,
    employee_signed_date date,
    supervisor_signed_date date,
    pdf_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT performance_reviews_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text])))
);


--
-- Name: petitioners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.petitioners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address_street text,
    address_city text,
    address_state text,
    address_zip text,
    address_country text,
    ein_fein text,
    deleted_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: portal_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_users (
    id uuid NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    role public.user_role DEFAULT 'employee'::public.user_role NOT NULL,
    employee_id uuid,
    avatar_initials text DEFAULT '?'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    must_reset_password boolean DEFAULT false NOT NULL,
    password_changed_at timestamp with time zone,
    announcements_last_viewed_at timestamp with time zone,
    temp_password_issued_at timestamp with time zone
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    unit_price numeric(12,2) DEFAULT 0 NOT NULL,
    unit text DEFAULT 'item'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: recurring_invoice_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_invoice_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_id uuid NOT NULL,
    title text,
    line_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    tax_rate numeric(5,2) DEFAULT 0 NOT NULL,
    po_number text,
    currency text DEFAULT 'USD'::text NOT NULL,
    payment_terms text DEFAULT 'net_30'::text NOT NULL,
    notes text,
    terms text,
    frequency text NOT NULL,
    start_date date NOT NULL,
    end_mode text DEFAULT 'never'::text NOT NULL,
    end_date date,
    max_occurrences integer,
    occurrences_made integer DEFAULT 0 NOT NULL,
    next_run_date date NOT NULL,
    auto_send boolean DEFAULT false NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: review_cycle_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.review_cycle_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    shift_type text DEFAULT 'morning'::text NOT NULL,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shifts_shift_type_check CHECK ((shift_type = ANY (ARRAY['morning'::text, 'afternoon'::text, 'evening'::text, 'night'::text, 'flexible'::text])))
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('TCKT-'::text, 'ticket_seq'::text) NOT NULL,
    case_id uuid,
    employee_id uuid,
    subject text NOT NULL,
    message text NOT NULL,
    status public.ticket_status DEFAULT 'new'::public.ticket_status NOT NULL,
    resolution text,
    created_by uuid NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_tickets_target_chk CHECK (((case_id IS NOT NULL) OR (employee_id IS NOT NULL)))
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value text,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tax_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    tax_year integer NOT NULL,
    document_type text NOT NULL,
    file_url text,
    notes text,
    generated_at timestamp with time zone,
    sent_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tax_documents_document_type_check CHECK ((document_type = ANY (ARRAY['W2'::text, '1099'::text, 'other'::text])))
);


--
-- Name: ticket_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timesheet_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timesheet_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    timesheet_id uuid NOT NULL,
    entry_date date NOT NULL,
    day_of_week text NOT NULL,
    hours numeric(4,2) DEFAULT 0 NOT NULL,
    is_billable boolean DEFAULT true NOT NULL
);


--
-- Name: timesheet_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.timesheet_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: timesheets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timesheets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_id text DEFAULT public.generate_display_id('TS-'::text, 'timesheet_seq'::text) NOT NULL,
    employee_id uuid NOT NULL,
    assignment_id uuid NOT NULL,
    client_id uuid NOT NULL,
    week_start_date date NOT NULL,
    week_end_date date NOT NULL,
    total_hours numeric(6,2) DEFAULT 0 NOT NULL,
    status public.timesheet_status DEFAULT 'draft'::public.timesheet_status NOT NULL,
    submitted_at timestamp with time zone,
    manager_approved_at timestamp with time zone,
    client_approved_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    leave_reason text,
    client_signed_url text,
    client_signed_filename text,
    hr_notes text
);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_display_id_key UNIQUE (display_id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: assets assets_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_display_id_key UNIQUE (display_id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: assignments assignments_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_display_id_key UNIQUE (display_id);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: case_filings case_filings_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_filings
    ADD CONSTRAINT case_filings_display_id_key UNIQUE (display_id);


--
-- Name: case_filings case_filings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_filings
    ADD CONSTRAINT case_filings_pkey PRIMARY KEY (id);


--
-- Name: case_message_reads case_message_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_message_reads
    ADD CONSTRAINT case_message_reads_pkey PRIMARY KEY (message_id, user_id);


--
-- Name: case_messages case_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_messages
    ADD CONSTRAINT case_messages_pkey PRIMARY KEY (id);


--
-- Name: case_notes case_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_notes
    ADD CONSTRAINT case_notes_pkey PRIMARY KEY (id);


--
-- Name: case_perm_details case_perm_details_case_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_perm_details
    ADD CONSTRAINT case_perm_details_case_id_key UNIQUE (case_id);


--
-- Name: case_perm_details case_perm_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_perm_details
    ADD CONSTRAINT case_perm_details_pkey PRIMARY KEY (id);


--
-- Name: case_status_steps case_status_steps_case_id_step_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_status_steps
    ADD CONSTRAINT case_status_steps_case_id_step_key_key UNIQUE (case_id, step_key);


--
-- Name: case_status_steps case_status_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_status_steps
    ADD CONSTRAINT case_status_steps_pkey PRIMARY KEY (id);


--
-- Name: case_tax_returns case_tax_returns_case_id_tax_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_tax_returns
    ADD CONSTRAINT case_tax_returns_case_id_tax_year_key UNIQUE (case_id, tax_year);


--
-- Name: case_tax_returns case_tax_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_tax_returns
    ADD CONSTRAINT case_tax_returns_pkey PRIMARY KEY (id);


--
-- Name: case_wages case_wages_case_id_wage_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_wages
    ADD CONSTRAINT case_wages_case_id_wage_year_key UNIQUE (case_id, wage_year);


--
-- Name: case_wages case_wages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_wages
    ADD CONSTRAINT case_wages_pkey PRIMARY KEY (id);


--
-- Name: cases cases_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_display_id_key UNIQUE (display_id);


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_pkey PRIMARY KEY (id);


--
-- Name: clients clients_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_display_id_key UNIQUE (display_id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: company_holidays company_holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_holidays
    ADD CONSTRAINT company_holidays_pkey PRIMARY KEY (id);


--
-- Name: department_budgets department_budgets_department_fiscal_year_budget_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_budgets
    ADD CONSTRAINT department_budgets_department_fiscal_year_budget_type_key UNIQUE (department, fiscal_year, budget_type);


--
-- Name: department_budgets department_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_budgets
    ADD CONSTRAINT department_budgets_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: employee_leave_entitlements employee_leave_entitlements_employee_id_leave_type_id_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_entitlements
    ADD CONSTRAINT employee_leave_entitlements_employee_id_leave_type_id_year_key UNIQUE (employee_id, leave_type_id, year);


--
-- Name: employee_leave_entitlements employee_leave_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_entitlements
    ADD CONSTRAINT employee_leave_entitlements_pkey PRIMARY KEY (id);


--
-- Name: employee_onboarding_tasks employee_onboarding_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_onboarding_tasks
    ADD CONSTRAINT employee_onboarding_tasks_pkey PRIMARY KEY (id);


--
-- Name: employee_skills employee_skills_employee_id_skill_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_skills
    ADD CONSTRAINT employee_skills_employee_id_skill_name_key UNIQUE (employee_id, skill_name);


--
-- Name: employee_skills employee_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_skills
    ADD CONSTRAINT employee_skills_pkey PRIMARY KEY (id);


--
-- Name: employees employees_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_display_id_key UNIQUE (display_id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: enrollment_forms enrollment_forms_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollment_forms
    ADD CONSTRAINT enrollment_forms_display_id_key UNIQUE (display_id);


--
-- Name: enrollment_forms enrollment_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollment_forms
    ADD CONSTRAINT enrollment_forms_pkey PRIMARY KEY (id);


--
-- Name: expense_reports expense_reports_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_reports
    ADD CONSTRAINT expense_reports_display_id_key UNIQUE (display_id);


--
-- Name: expense_reports expense_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_reports
    ADD CONSTRAINT expense_reports_pkey PRIMARY KEY (id);


--
-- Name: invoice_line_items invoice_line_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_templates invoice_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_templates
    ADD CONSTRAINT invoice_templates_pkey PRIMARY KEY (id);


--
-- Name: invoice_timesheets invoice_timesheets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_timesheets
    ADD CONSTRAINT invoice_timesheets_pkey PRIMARY KEY (invoice_id, timesheet_id);


--
-- Name: invoice_timesheets invoice_timesheets_timesheet_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_timesheets
    ADD CONSTRAINT invoice_timesheets_timesheet_id_unique UNIQUE (timesheet_id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_public_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_public_token_key UNIQUE (public_token);


--
-- Name: leave_requests leave_requests_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_display_id_key UNIQUE (display_id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_code_key UNIQUE (code);


--
-- Name: leave_types leave_types_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_display_id_key UNIQUE (display_id);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: monthly_timesheets monthly_timesheets_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_timesheets
    ADD CONSTRAINT monthly_timesheets_display_id_key UNIQUE (display_id);


--
-- Name: monthly_timesheets monthly_timesheets_employee_id_year_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_timesheets
    ADD CONSTRAINT monthly_timesheets_employee_id_year_month_key UNIQUE (employee_id, year, month);


--
-- Name: monthly_timesheets monthly_timesheets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_timesheets
    ADD CONSTRAINT monthly_timesheets_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offboarding_tasks offboarding_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_tasks
    ADD CONSTRAINT offboarding_tasks_pkey PRIMARY KEY (id);


--
-- Name: offboarding_templates offboarding_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_templates
    ADD CONSTRAINT offboarding_templates_pkey PRIMARY KEY (id);


--
-- Name: onboarding_change_requests onboarding_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_change_requests
    ADD CONSTRAINT onboarding_change_requests_pkey PRIMARY KEY (id);


--
-- Name: onboarding_checklist_templates onboarding_checklist_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_checklist_templates
    ADD CONSTRAINT onboarding_checklist_templates_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: performance_reviews performance_reviews_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_reviews
    ADD CONSTRAINT performance_reviews_display_id_key UNIQUE (display_id);


--
-- Name: performance_reviews performance_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_reviews
    ADD CONSTRAINT performance_reviews_pkey PRIMARY KEY (id);


--
-- Name: petitioners petitioners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petitioners
    ADD CONSTRAINT petitioners_pkey PRIMARY KEY (id);


--
-- Name: portal_users portal_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_users
    ADD CONSTRAINT portal_users_email_key UNIQUE (email);


--
-- Name: portal_users portal_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_users
    ADD CONSTRAINT portal_users_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: recurring_invoice_templates recurring_invoice_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_invoice_templates
    ADD CONSTRAINT recurring_invoice_templates_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_display_id_key UNIQUE (display_id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: tax_documents tax_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_documents
    ADD CONSTRAINT tax_documents_pkey PRIMARY KEY (id);


--
-- Name: timesheet_entries timesheet_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timesheet_entries
    ADD CONSTRAINT timesheet_entries_pkey PRIMARY KEY (id);


--
-- Name: timesheet_entries timesheet_entries_timesheet_id_entry_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timesheet_entries
    ADD CONSTRAINT timesheet_entries_timesheet_id_entry_date_key UNIQUE (timesheet_id, entry_date);


--
-- Name: timesheets timesheets_display_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timesheets
    ADD CONSTRAINT timesheets_display_id_key UNIQUE (display_id);


--
-- Name: timesheets timesheets_employee_id_assignment_id_week_start_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timesheets
    ADD CONSTRAINT timesheets_employee_id_assignment_id_week_start_date_key UNIQUE (employee_id, assignment_id, week_start_date);


--
-- Name: timesheets timesheets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timesheets
    ADD CONSTRAINT timesheets_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_logs_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_actor ON public.activity_logs USING btree (actor_id, created_at DESC);


--
-- Name: idx_activity_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_entity ON public.activity_logs USING btree (entity_type, entity_id);


--
-- Name: idx_announcements_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_created ON public.announcements USING btree (created_at DESC);


--
-- Name: idx_announcements_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_expires ON public.announcements USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: idx_announcements_pinned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_pinned ON public.announcements USING btree (is_pinned) WHERE (deleted_at IS NULL);


--
-- Name: idx_assets_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_employee ON public.assets USING btree (assigned_to);


--
-- Name: idx_assets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assets_status ON public.assets USING btree (status);


--
-- Name: idx_assignments_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_client ON public.assignments USING btree (client_id);


--
-- Name: idx_assignments_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_created_by ON public.assignments USING btree (created_by);


--
-- Name: idx_assignments_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_employee ON public.assignments USING btree (employee_id);


--
-- Name: idx_assignments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_status ON public.assignments USING btree (status);


--
-- Name: idx_assignments_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignments_updated_by ON public.assignments USING btree (updated_by);


--
-- Name: idx_case_filings_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_filings_case ON public.case_filings USING btree (case_id);


--
-- Name: idx_case_messages_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_messages_case ON public.case_messages USING btree (case_id, created_at DESC);


--
-- Name: idx_case_notes_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_notes_case ON public.case_notes USING btree (case_id, created_at DESC);


--
-- Name: idx_case_status_steps_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_status_steps_case ON public.case_status_steps USING btree (case_id, step_order);


--
-- Name: idx_case_tax_returns_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_tax_returns_case ON public.case_tax_returns USING btree (case_id);


--
-- Name: idx_case_wages_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_case_wages_case ON public.case_wages USING btree (case_id);


--
-- Name: idx_cases_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_employee ON public.cases USING btree (employee_id);


--
-- Name: idx_cases_petitioner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_petitioner ON public.cases USING btree (petitioner_id);


--
-- Name: idx_cases_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_status ON public.cases USING btree (status);


--
-- Name: idx_clients_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_created_by ON public.clients USING btree (created_by);


--
-- Name: idx_clients_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_status ON public.clients USING btree (status);


--
-- Name: idx_documents_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_entity ON public.documents USING btree (entity_type, entity_id);


--
-- Name: idx_employee_skills_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_skills_employee ON public.employee_skills USING btree (employee_id);


--
-- Name: idx_employee_skills_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_skills_name ON public.employee_skills USING btree (skill_name);


--
-- Name: idx_employees_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_created_by ON public.employees USING btree (created_by);


--
-- Name: idx_employees_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_dept ON public.employees USING btree (department);


--
-- Name: idx_employees_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_email ON public.employees USING btree (email);


--
-- Name: idx_employees_leave_return; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_leave_return ON public.employees USING btree (leave_return_date) WHERE (leave_return_date IS NOT NULL);


--
-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_status ON public.employees USING btree (status);


--
-- Name: idx_enrollment_forms_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollment_forms_employee ON public.enrollment_forms USING btree (employee_id);


--
-- Name: idx_enrollment_forms_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollment_forms_status ON public.enrollment_forms USING btree (status);


--
-- Name: idx_entries_timesheet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entries_timesheet ON public.timesheet_entries USING btree (timesheet_id);


--
-- Name: idx_expense_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_date ON public.expense_reports USING btree (expense_date DESC);


--
-- Name: idx_expense_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_employee ON public.expense_reports USING btree (employee_id);


--
-- Name: idx_expense_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expense_status ON public.expense_reports USING btree (status);


--
-- Name: idx_invoices_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_client ON public.invoices USING btree (client_id);


--
-- Name: idx_invoices_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_created_by ON public.invoices USING btree (created_by);


--
-- Name: idx_invoices_doc_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_doc_type ON public.invoices USING btree (doc_type);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_leave_entitlements_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_entitlements_employee ON public.employee_leave_entitlements USING btree (employee_id);


--
-- Name: idx_leave_entitlements_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_entitlements_year ON public.employee_leave_entitlements USING btree (year);


--
-- Name: idx_leave_requests_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_dates ON public.leave_requests USING btree (start_date, end_date);


--
-- Name: idx_leave_requests_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_employee ON public.leave_requests USING btree (employee_id);


--
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- Name: idx_line_items_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_line_items_invoice ON public.invoice_line_items USING btree (invoice_id);


--
-- Name: idx_monthly_ts_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_monthly_ts_employee ON public.monthly_timesheets USING btree (employee_id);


--
-- Name: idx_monthly_ts_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_monthly_ts_period ON public.monthly_timesheets USING btree (year, month);


--
-- Name: idx_monthly_ts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_monthly_ts_status ON public.monthly_timesheets USING btree (status);


--
-- Name: idx_notifications_admin_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_admin_read ON public.notifications USING btree (admin_read) WHERE (admin_read = false);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, read, created_at DESC);


--
-- Name: idx_offboarding_tasks_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_offboarding_tasks_employee ON public.offboarding_tasks USING btree (employee_id);


--
-- Name: idx_onboarding_change_requests_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_change_requests_employee ON public.onboarding_change_requests USING btree (employee_id, requested_at DESC);


--
-- Name: idx_onboarding_tasks_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_tasks_employee ON public.employee_onboarding_tasks USING btree (employee_id);


--
-- Name: idx_payments_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_invoice ON public.payments USING btree (invoice_id);


--
-- Name: idx_performance_reviews_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_reviews_employee ON public.performance_reviews USING btree (employee_id);


--
-- Name: idx_performance_reviews_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_performance_reviews_status ON public.performance_reviews USING btree (status);


--
-- Name: idx_recurring_next_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recurring_next_run ON public.recurring_invoice_templates USING btree (next_run_date) WHERE (status = 'active'::text);


--
-- Name: idx_shifts_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shifts_date ON public.shifts USING btree (date);


--
-- Name: idx_shifts_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shifts_employee ON public.shifts USING btree (employee_id);


--
-- Name: idx_support_tickets_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_case ON public.support_tickets USING btree (case_id);


--
-- Name: idx_support_tickets_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_created_by ON public.support_tickets USING btree (created_by);


--
-- Name: idx_support_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (status);


--
-- Name: idx_tax_documents_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tax_documents_employee ON public.tax_documents USING btree (employee_id);


--
-- Name: idx_tax_documents_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tax_documents_year ON public.tax_documents USING btree (tax_year);


--
-- Name: idx_timesheets_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timesheets_client ON public.timesheets USING btree (client_id);


--
-- Name: idx_timesheets_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timesheets_employee ON public.timesheets USING btree (employee_id);


--
-- Name: idx_timesheets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timesheets_status ON public.timesheets USING btree (status);


--
-- Name: idx_timesheets_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_timesheets_week ON public.timesheets USING btree (week_start_date);


--
-- Name: announcements trg_announcements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: assets trg_assets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: assignments trg_assignments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_assignments_updated_at BEFORE UPDATE ON public.assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: case_filings trg_case_filings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_case_filings_updated_at BEFORE UPDATE ON public.case_filings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: case_perm_details trg_case_perm_details_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_case_perm_details_updated_at BEFORE UPDATE ON public.case_perm_details FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: case_tax_returns trg_case_tax_returns_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_case_tax_returns_updated_at BEFORE UPDATE ON public.case_tax_returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: case_wages trg_case_wages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_case_wages_updated_at BEFORE UPDATE ON public.case_wages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: cases trg_cases_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cases_updated_at BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: clients trg_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: company_holidays trg_company_holidays_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_company_holidays_updated_at BEFORE UPDATE ON public.company_holidays FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: department_budgets trg_department_budgets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_department_budgets_updated_at BEFORE UPDATE ON public.department_budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: employee_skills trg_employee_skills_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_employee_skills_updated_at BEFORE UPDATE ON public.employee_skills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: employees trg_employees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: expense_reports trg_expense_reports_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_expense_reports_updated_at BEFORE UPDATE ON public.expense_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: invoices trg_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: employee_leave_entitlements trg_leave_entitlements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leave_entitlements_updated_at BEFORE UPDATE ON public.employee_leave_entitlements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: leave_requests trg_leave_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: leave_types trg_leave_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_leave_types_updated_at BEFORE UPDATE ON public.leave_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: monthly_timesheets trg_monthly_timesheets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_monthly_timesheets_updated_at BEFORE UPDATE ON public.monthly_timesheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: offboarding_templates trg_offboarding_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_offboarding_templates_updated_at BEFORE UPDATE ON public.offboarding_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: onboarding_checklist_templates trg_onboarding_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_onboarding_templates_updated_at BEFORE UPDATE ON public.onboarding_checklist_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: petitioners trg_petitioners_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_petitioners_updated_at BEFORE UPDATE ON public.petitioners FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: portal_users trg_portal_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_portal_users_updated_at BEFORE UPDATE ON public.portal_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: products trg_products_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: recurring_invoice_templates trg_recurring_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recurring_updated_at BEFORE UPDATE ON public.recurring_invoice_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: shifts trg_shifts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: support_tickets trg_support_tickets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: tax_documents trg_tax_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tax_documents_updated_at BEFORE UPDATE ON public.tax_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: timesheets trg_timesheets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_timesheets_updated_at BEFORE UPDATE ON public.timesheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: activity_logs activity_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: announcements announcements_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: assets assets_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: assets assets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: assignments assignments_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: assignments assignments_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_reporting_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_reporting_manager_id_fkey FOREIGN KEY (reporting_manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: assignments assignments_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: case_filings case_filings_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_filings
    ADD CONSTRAINT case_filings_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_filings case_filings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_filings
    ADD CONSTRAINT case_filings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: case_message_reads case_message_reads_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_message_reads
    ADD CONSTRAINT case_message_reads_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.case_messages(id) ON DELETE CASCADE;


--
-- Name: case_message_reads case_message_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_message_reads
    ADD CONSTRAINT case_message_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.portal_users(id) ON DELETE CASCADE;


--
-- Name: case_messages case_messages_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_messages
    ADD CONSTRAINT case_messages_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: case_messages case_messages_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_messages
    ADD CONSTRAINT case_messages_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_notes case_notes_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_notes
    ADD CONSTRAINT case_notes_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: case_notes case_notes_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_notes
    ADD CONSTRAINT case_notes_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_notes case_notes_tagged_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_notes
    ADD CONSTRAINT case_notes_tagged_to_fkey FOREIGN KEY (tagged_to) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: case_perm_details case_perm_details_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_perm_details
    ADD CONSTRAINT case_perm_details_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_status_steps case_status_steps_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_status_steps
    ADD CONSTRAINT case_status_steps_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_tax_returns case_tax_returns_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_tax_returns
    ADD CONSTRAINT case_tax_returns_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_tax_returns case_tax_returns_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_tax_returns
    ADD CONSTRAINT case_tax_returns_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: case_wages case_wages_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_wages
    ADD CONSTRAINT case_wages_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE;


--
-- Name: case_wages case_wages_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_wages
    ADD CONSTRAINT case_wages_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;


--
-- Name: cases cases_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: cases cases_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: cases cases_petitioner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cases
    ADD CONSTRAINT cases_petitioner_id_fkey FOREIGN KEY (petitioner_id) REFERENCES public.petitioners(id) ON DELETE SET NULL;


--
-- Name: clients clients_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: department_budgets department_budgets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_budgets
    ADD CONSTRAINT department_budgets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: email_templates email_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: employee_leave_entitlements employee_leave_entitlements_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_entitlements
    ADD CONSTRAINT employee_leave_entitlements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_leave_entitlements employee_leave_entitlements_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_entitlements
    ADD CONSTRAINT employee_leave_entitlements_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- Name: employee_onboarding_tasks employee_onboarding_tasks_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_onboarding_tasks
    ADD CONSTRAINT employee_onboarding_tasks_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: employee_onboarding_tasks employee_onboarding_tasks_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_onboarding_tasks
    ADD CONSTRAINT employee_onboarding_tasks_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_onboarding_tasks employee_onboarding_tasks_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_onboarding_tasks
    ADD CONSTRAINT employee_onboarding_tasks_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.onboarding_checklist_templates(id) ON DELETE SET NULL;


--
-- Name: employee_skills employee_skills_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_skills
    ADD CONSTRAINT employee_skills_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employees employees_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: employees employees_onboarding_change_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_onboarding_change_requested_by_fkey FOREIGN KEY (onboarding_change_requested_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: employees employees_reporting_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_reporting_manager_id_fkey FOREIGN KEY (reporting_manager_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: enrollment_forms enrollment_forms_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollment_forms
    ADD CONSTRAINT enrollment_forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: enrollment_forms enrollment_forms_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollment_forms
    ADD CONSTRAINT enrollment_forms_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: expense_reports expense_reports_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_reports
    ADD CONSTRAINT expense_reports_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: expense_reports expense_reports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_reports
    ADD CONSTRAINT expense_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: invoices fk_invoices_recurring_template; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT fk_invoices_recurring_template FOREIGN KEY (recurring_template_id) REFERENCES public.recurring_invoice_templates(id) ON DELETE SET NULL;


--
-- Name: invoice_line_items invoice_line_items_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: invoice_line_items invoice_line_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_line_items invoice_line_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: invoice_line_items invoice_line_items_timesheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_line_items
    ADD CONSTRAINT invoice_line_items_timesheet_id_fkey FOREIGN KEY (timesheet_id) REFERENCES public.timesheets(id) ON DELETE SET NULL;


--
-- Name: invoice_templates invoice_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_templates
    ADD CONSTRAINT invoice_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: invoice_timesheets invoice_timesheets_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_timesheets
    ADD CONSTRAINT invoice_timesheets_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_timesheets invoice_timesheets_timesheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_timesheets
    ADD CONSTRAINT invoice_timesheets_timesheet_id_fkey FOREIGN KEY (timesheet_id) REFERENCES public.timesheets(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_converted_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_converted_invoice_id_fkey FOREIGN KEY (converted_invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_email_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_email_template_id_fkey FOREIGN KEY (email_template_id) REFERENCES public.email_templates(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_invoice_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_template_id_fkey FOREIGN KEY (invoice_template_id) REFERENCES public.invoice_templates(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: monthly_timesheets monthly_timesheets_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_timesheets
    ADD CONSTRAINT monthly_timesheets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: monthly_timesheets monthly_timesheets_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_timesheets
    ADD CONSTRAINT monthly_timesheets_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.portal_users(id) ON DELETE CASCADE;


--
-- Name: offboarding_tasks offboarding_tasks_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_tasks
    ADD CONSTRAINT offboarding_tasks_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: offboarding_tasks offboarding_tasks_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_tasks
    ADD CONSTRAINT offboarding_tasks_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: offboarding_tasks offboarding_tasks_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offboarding_tasks
    ADD CONSTRAINT offboarding_tasks_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.offboarding_templates(id) ON DELETE SET NULL;


--
-- Name: onboarding_change_requests onboarding_change_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_change_requests
    ADD CONSTRAINT onboarding_change_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: onboarding_change_requests onboarding_change_requests_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_change_requests
    ADD CONSTRAINT onboarding_change_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: payments payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: performance_reviews performance_reviews_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_reviews
    ADD CONSTRAINT performance_reviews_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: performance_reviews performance_reviews_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_reviews
    ADD CONSTRAINT performance_reviews_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: petitioners petitioners_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.petitioners
    ADD CONSTRAINT petitioners_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: portal_users portal_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

-- [ported] dropped - portal_users.id now holds the Cognito sub, not an auth.users id:
-- ALTER TABLE ONLY public.portal_users
--     ADD CONSTRAINT portal_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: products products_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: recurring_invoice_templates recurring_invoice_templates_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_invoice_templates
    ADD CONSTRAINT recurring_invoice_templates_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: recurring_invoice_templates recurring_invoice_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_invoice_templates
    ADD CONSTRAINT recurring_invoice_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: shifts shifts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: shifts shifts_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: tax_documents tax_documents_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_documents
    ADD CONSTRAINT tax_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.portal_users(id) ON DELETE SET NULL;


--
-- Name: tax_documents tax_documents_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_documents
    ADD CONSTRAINT tax_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: timesheet_entries timesheet_entries_timesheet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timesheet_entries
    ADD CONSTRAINT timesheet_entries_timesheet_id_fkey FOREIGN KEY (timesheet_id) REFERENCES public.timesheets(id) ON DELETE CASCADE;


--
-- Name: timesheets timesheets_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timesheets
    ADD CONSTRAINT timesheets_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: timesheets timesheets_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timesheets
    ADD CONSTRAINT timesheets_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: timesheets timesheets_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timesheets
    ADD CONSTRAINT timesheets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: assets; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

--
-- Name: assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: case_filings; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.case_filings ENABLE ROW LEVEL SECURITY;

--
-- Name: case_message_reads; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.case_message_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: case_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.case_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: case_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.case_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: case_perm_details; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.case_perm_details ENABLE ROW LEVEL SECURITY;

--
-- Name: case_status_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.case_status_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: case_tax_returns; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.case_tax_returns ENABLE ROW LEVEL SECURITY;

--
-- Name: case_wages; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.case_wages ENABLE ROW LEVEL SECURITY;

--
-- Name: cases; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

--
-- Name: clients; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

--
-- Name: company_holidays; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.company_holidays ENABLE ROW LEVEL SECURITY;

--
-- Name: department_budgets; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.department_budgets ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_leave_entitlements; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.employee_leave_entitlements ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_onboarding_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.employee_onboarding_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: employee_skills; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;

--
-- Name: employees; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

--
-- Name: enrollment_forms; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.enrollment_forms ENABLE ROW LEVEL SECURITY;

--
-- Name: expense_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.expense_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_line_items; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_timesheets; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.invoice_timesheets ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: leave_types; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

--
-- Name: monthly_timesheets; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.monthly_timesheets ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: offboarding_tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.offboarding_tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: offboarding_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.offboarding_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_change_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.onboarding_change_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: onboarding_checklist_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.onboarding_checklist_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: performance_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: petitioners; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.petitioners ENABLE ROW LEVEL SECURITY;

--
-- Name: portal_users; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;

--
-- Name: activity_logs service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.activity_logs USING (false);


--
-- Name: announcements service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.announcements USING (false);


--
-- Name: assets service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.assets USING (false);


--
-- Name: assignments service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.assignments USING (false);


--
-- Name: case_filings service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.case_filings USING (false);


--
-- Name: case_message_reads service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.case_message_reads USING (false);


--
-- Name: case_messages service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.case_messages USING (false);


--
-- Name: case_notes service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.case_notes USING (false);


--
-- Name: case_perm_details service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.case_perm_details USING (false);


--
-- Name: case_status_steps service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.case_status_steps USING (false);


--
-- Name: case_tax_returns service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.case_tax_returns USING (false);


--
-- Name: case_wages service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.case_wages USING (false);


--
-- Name: cases service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.cases USING (false);


--
-- Name: clients service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.clients USING (false);


--
-- Name: company_holidays service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.company_holidays USING (false);


--
-- Name: department_budgets service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.department_budgets USING (false);


--
-- Name: documents service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.documents USING (false);


--
-- Name: employee_leave_entitlements service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.employee_leave_entitlements USING (false);


--
-- Name: employee_onboarding_tasks service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.employee_onboarding_tasks USING (false);


--
-- Name: employee_skills service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.employee_skills USING (false);


--
-- Name: employees service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.employees USING (false);


--
-- Name: enrollment_forms service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.enrollment_forms USING (false);


--
-- Name: expense_reports service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.expense_reports USING (false);


--
-- Name: invoice_line_items service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.invoice_line_items USING (false);


--
-- Name: invoice_timesheets service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.invoice_timesheets USING (false);


--
-- Name: invoices service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.invoices USING (false);


--
-- Name: leave_requests service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.leave_requests USING (false);


--
-- Name: leave_types service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.leave_types USING (false);


--
-- Name: monthly_timesheets service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.monthly_timesheets USING (false);


--
-- Name: notifications service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.notifications USING (false);


--
-- Name: offboarding_tasks service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.offboarding_tasks USING (false);


--
-- Name: offboarding_templates service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.offboarding_templates USING (false);


--
-- Name: onboarding_change_requests service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.onboarding_change_requests USING (false);


--
-- Name: onboarding_checklist_templates service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.onboarding_checklist_templates USING (false);


--
-- Name: performance_reviews service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.performance_reviews USING (false);


--
-- Name: petitioners service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.petitioners USING (false);


--
-- Name: portal_users service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.portal_users USING (false);


--
-- Name: shifts service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.shifts USING (false);


--
-- Name: support_tickets service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.support_tickets USING (false);


--
-- Name: system_settings service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.system_settings USING (false);


--
-- Name: tax_documents service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.tax_documents USING (false);


--
-- Name: timesheet_entries service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.timesheet_entries USING (false);


--
-- Name: timesheets service_role_only; Type: POLICY; Schema: public; Owner: -
--

-- [ported] CREATE POLICY service_role_only ON public.timesheets USING (false);


--
-- Name: shifts; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: support_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: tax_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.tax_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: timesheet_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: timesheets; Type: ROW SECURITY; Schema: public; Owner: -
--

-- [ported] ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--



