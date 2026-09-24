CREATE TABLE IF NOT EXISTS organizations (
 id uuid PRIMARY KEY, name text NOT NULL, revision integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id), name text NOT NULL,
 email text NOT NULL UNIQUE, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS sites (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id), name text NOT NULL,
 owner_name text NOT NULL, phone text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '',
 work_type text NOT NULL CHECK(work_type IN ('LABOUR','MATERIAL')),
 pricing text NOT NULL CHECK(pricing IN ('FIXED','UNIT','DAILY')),
 contract_amount bigint NOT NULL CHECK(contract_amount >= 0), quantity numeric(12,3) NOT NULL DEFAULT 1,
 unit text NOT NULL DEFAULT 'job', unit_rate bigint NOT NULL DEFAULT 0 CHECK(unit_rate >= 0),
 remaining_estimate bigint NOT NULL DEFAULT 0 CHECK(remaining_estimate >= 0),
 status text NOT NULL DEFAULT 'ONGOING' CHECK(status IN ('UPCOMING','ONGOING','PAUSED','COMPLETED')),
 start_date date NOT NULL, end_date date, notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,id)
);
CREATE TABLE IF NOT EXISTS workers (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id), name text NOT NULL,
 phone text NOT NULL DEFAULT '', skill text NOT NULL, daily_rate bigint NOT NULL CHECK(daily_rate >= 0),
 overtime_rate bigint NOT NULL CHECK(overtime_rate >= 0), active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,id)
);
CREATE TABLE IF NOT EXISTS attendance (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, site_id uuid NOT NULL, worker_id uuid NOT NULL,
 date date NOT NULL, units numeric(3,2) NOT NULL CHECK(units IN (0,0.5,1)),
 overtime_minutes integer NOT NULL CHECK(overtime_minutes BETWEEN 0 AND 960),
 daily_rate bigint NOT NULL CHECK(daily_rate >= 0), overtime_rate bigint NOT NULL CHECK(overtime_rate >= 0),
 amount bigint NOT NULL CHECK(amount >= 0), notes text NOT NULL DEFAULT '',
 UNIQUE(org_id,site_id,worker_id,date),
 FOREIGN KEY(org_id,site_id) REFERENCES sites(org_id,id),
 FOREIGN KEY(org_id,worker_id) REFERENCES workers(org_id,id)
);
CREATE TABLE IF NOT EXISTS entries (
 id uuid PRIMARY KEY, org_id uuid NOT NULL, site_id uuid NOT NULL, worker_id uuid,
 kind text NOT NULL CHECK(kind IN ('RECEIPT','WAGE_PAYMENT','MATERIAL','EXPENSE','EXTRA','SUPPLIER_PAYMENT')),
 date date NOT NULL, amount bigint NOT NULL CHECK(amount > 0),
 description text NOT NULL, party text NOT NULL DEFAULT '', mode text NOT NULL DEFAULT 'CASH',
 reference text NOT NULL DEFAULT '', due_date date, linked_entry_id uuid,
 quantity numeric(12,3), unit text, voided_at timestamptz, void_reason text,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id,id),
 FOREIGN KEY(org_id,site_id) REFERENCES sites(org_id,id),
 FOREIGN KEY(org_id,worker_id) REFERENCES workers(org_id,id),
 FOREIGN KEY(org_id,linked_entry_id) REFERENCES entries(org_id,id),
 CHECK((kind = 'WAGE_PAYMENT') = (worker_id IS NOT NULL)),
 CHECK((kind = 'SUPPLIER_PAYMENT') = (linked_entry_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS audit (
 id uuid PRIMARY KEY, org_id uuid NOT NULL REFERENCES organizations(id), user_id uuid NOT NULL REFERENCES users(id),
 action text NOT NULL, entity_id uuid NOT NULL, before_data jsonb, after_data jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS requests (
 org_id uuid NOT NULL REFERENCES organizations(id), key uuid NOT NULL, hash text NOT NULL,
 result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(org_id,key)
);
CREATE INDEX IF NOT EXISTS entries_org_site_date ON entries(org_id,site_id,date);
CREATE INDEX IF NOT EXISTS attendance_org_worker_date ON attendance(org_id,worker_id,date);
CREATE INDEX IF NOT EXISTS audit_org_date ON audit(org_id,created_at);
