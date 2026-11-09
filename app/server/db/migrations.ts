/**
 * App-owned migrations. Append new entries; never edit or renumber an
 * applied one. Every change must be additive.
 */

import type { MigrationEntry } from "@agent-native/core/db";

export const MIGRATIONS_TABLE = "tallyfoil_migrations";

export const MIGRATIONS: MigrationEntry[] = [
  {
    version: 1,
    name: "tallyfoil-initial-schema",
    sql: `
      CREATE TABLE IF NOT EXISTS vendors (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        is_sample BOOLEAN NOT NULL DEFAULT false,
        currency TEXT NOT NULL DEFAULT 'USD',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS vendors_owner_idx ON vendors (owner_email);

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        vendor_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        text TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        is_sample BOOLEAN NOT NULL DEFAULT false,
        status TEXT NOT NULL DEFAULT 'new',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS documents_vendor_idx ON documents (owner_email, vendor_id);
      CREATE UNIQUE INDEX IF NOT EXISTS documents_sha_uq ON documents (owner_email, vendor_id, sha256);

      CREATE TABLE IF NOT EXISTS terms (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        vendor_id TEXT NOT NULL,
        key TEXT NOT NULL,
        meter TEXT,
        value_num BIGINT,
        value_text TEXT,
        value_date TEXT,
        effective_from TEXT,
        effective_to TEXT,
        evidence_json JSONB,
        source TEXT NOT NULL DEFAULT 'agent',
        revision INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS terms_vendor_idx ON terms (owner_email, vendor_id);

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        vendor_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        invoice_date TEXT NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        total_cents BIGINT NOT NULL,
        evidence_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS invoices_vendor_idx ON invoices (owner_email, vendor_id);
      CREATE UNIQUE INDEX IF NOT EXISTS invoices_number_uq ON invoices (owner_email, vendor_id, invoice_number);

      CREATE TABLE IF NOT EXISTS invoice_lines (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        invoice_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        kind TEXT NOT NULL,
        description TEXT NOT NULL,
        meter TEXT,
        quantity BIGINT NOT NULL,
        unit_price_micros BIGINT NOT NULL,
        amount_cents BIGINT NOT NULL,
        evidence_json JSONB
      );
      CREATE INDEX IF NOT EXISTS invoice_lines_invoice_idx ON invoice_lines (owner_email, invoice_id);

      CREATE TABLE IF NOT EXISTS usage_totals (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        vendor_id TEXT NOT NULL,
        document_id TEXT NOT NULL,
        meter TEXT NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        quantity BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS usage_totals_vendor_idx ON usage_totals (owner_email, vendor_id);

      CREATE TABLE IF NOT EXISTS vendor_rules (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        vendor_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload_json JSONB NOT NULL,
        reason TEXT NOT NULL,
        proof_json JSONB,
        created_by TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS vendor_rules_vendor_idx ON vendor_rules (owner_email, vendor_id);

      CREATE TABLE IF NOT EXISTS audit_runs (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        scope TEXT NOT NULL,
        engine_version TEXT NOT NULL,
        as_of TEXT NOT NULL,
        recoverable_cents BIGINT NOT NULL,
        at_risk_cents BIGINT NOT NULL,
        finding_count INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS audit_runs_owner_idx ON audit_runs (owner_email, created_at);

      CREATE TABLE IF NOT EXISTS findings (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        run_id TEXT NOT NULL,
        vendor_id TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        "check" TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        title TEXT NOT NULL,
        explanation TEXT NOT NULL,
        amount_cents BIGINT NOT NULL,
        at_risk_cents BIGINT NOT NULL DEFAULT 0,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        period_label TEXT NOT NULL,
        invoice_number TEXT,
        meter TEXT,
        deadline TEXT,
        math_json JSONB NOT NULL,
        refs_json JSONB NOT NULL,
        explained_by_rule_ids JSONB,
        reject_reason TEXT,
        reviewed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS findings_vendor_idx ON findings (owner_email, vendor_id);
      CREATE UNIQUE INDEX IF NOT EXISTS findings_fingerprint_uq ON findings (owner_email, vendor_id, fingerprint);

      CREATE TABLE IF NOT EXISTS disputes (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        vendor_id TEXT NOT NULL,
        finding_ids_json JSONB NOT NULL,
        subject TEXT NOT NULL,
        intro TEXT NOT NULL,
        closing TEXT NOT NULL,
        evidence_table_md TEXT NOT NULL,
        amount_cents BIGINT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        revision INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS disputes_vendor_idx ON disputes (owner_email, vendor_id);
    `,
  },
];
