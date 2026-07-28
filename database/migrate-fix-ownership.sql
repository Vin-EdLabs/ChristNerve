-- Run ONCE as postgres (superuser) on the VPS:
--   sudo -u postgres psql -d christnerve -f database/migrate-fix-ownership.sql
--
-- Makes school_app_user owner of all public tables/sequences so
-- npm run build migrations can ALTER TABLE.

DO $$
DECLARE
  r RECORD;
  app_role TEXT := 'school_app_user';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    RAISE NOTICE 'Role % does not exist — skip ownership change', app_role;
    RETURN;
  END IF;

  FOR r IN
    SELECT c.relname AS name, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'S', 'v', 'm') -- tables, partitioned, sequences, views, matviews
  LOOP
    BEGIN
      IF r.relkind = 'S' THEN
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO %I', r.name, app_role);
      ELSIF r.relkind IN ('v', 'm') THEN
        EXECUTE format('ALTER %s public.%I OWNER TO %I',
          CASE WHEN r.relkind = 'm' THEN 'MATERIALIZED VIEW' ELSE 'VIEW' END,
          r.name, app_role);
      ELSE
        EXECUTE format('ALTER TABLE public.%I OWNER TO %I', r.name, app_role);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skip %: %', r.name, SQLERRM;
    END;
  END LOOP;

  EXECUTE format('GRANT ALL ON SCHEMA public TO %I', app_role);
  EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA public TO %I', app_role);
  EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO %I', app_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO %I', app_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO %I', app_role);

  RAISE NOTICE 'Ownership transferred to %', app_role;
END $$;
