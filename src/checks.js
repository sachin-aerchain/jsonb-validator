const CHECKS = [
  {
    id: 'coalesce_agg',
    level: 'error',
    title: 'Missing COALESCE on jsonb_agg result',
    detect: sql => {
      const hasAgg = /jsonb_agg\s*\(/i.test(sql);
      const hasCoalesce = /COALESCE\s*\([\s\S]{0,80}jsonb_agg/i.test(sql);
      return hasAgg && !hasCoalesce;
    },
    desc: 'jsonb_agg() returns NULL when it aggregates zero rows — not an empty array. Without COALESCE, this NULL silently overwrites the target field (e.g. section fields → null), corrupting data.',
    fix: `-- Wrap every jsonb_agg with a COALESCE fallback:
jsonb_set(section, '{fields}',
  COALESCE(
    (SELECT jsonb_agg(...)
     FROM jsonb_array_elements(section->'fields') AS field),
    section->'fields'   -- preserve original if agg returns null
  )
)`
  },
  {
    id: 'coalesce_sections',
    level: 'error',
    title: 'No null fallback for sections array result',
    detect: sql => {
      const setsSection = /jsonb_set\s*\([^,]+,\s*'\{sections\}'/i.test(sql);
      const hasCoalesce = /COALESCE[\s\S]{0,300}section/i.test(sql);
      return setsSection && !hasCoalesce;
    },
    desc: 'If the outer SELECT over sections returns NULL (e.g. schema has no sections, or all sections are filtered out), jsonb_set will set schema.sections to null, wiping all sections.',
    fix: `jsonb_set(schema, '{sections}',
  COALESCE(
    (SELECT jsonb_agg(...)
     FROM jsonb_array_elements(schema->'sections') AS section),
    schema->'sections'   -- keep original on failure
  )
)`
  },
  {
    id: 'no_schema_null_guard',
    level: 'error',
    title: 'No NULL guard on schema column',
    detect: sql => {
      const isSchemaUpdate = /UPDATE\s+["']?(?:QuoteRequests|TrTemplates)/i.test(sql);
      const hasNullGuard = /schema\s+IS\s+NOT\s+NULL/i.test(sql);
      return isSchemaUpdate && !hasNullGuard;
    },
    desc: 'Rows where schema IS NULL will cause jsonb_set and jsonb_array_elements to propagate NULL silently, potentially corrupting otherwise-fine rows or generating unexpected results.',
    fix: `WHERE "templateId" IN (...)
  AND active = 1
  AND schema IS NOT NULL   -- skip rows with null schema`
  },
  {
    id: 'no_typeof_guard',
    level: 'warning',
    title: 'No jsonb_typeof guard on sections or fields',
    detect: sql => {
      const usesArrElem = /jsonb_array_elements\s*\([^)]*(?:sections|fields)/i.test(sql);
      const hasTypeof = /jsonb_typeof\s*\(/i.test(sql);
      return usesArrElem && !hasTypeof;
    },
    desc: "If sections or fields holds a non-array type (object, string, or null), jsonb_array_elements will throw an error or return nothing, causing silent null propagation further up the query.",
    fix: `-- Add a type guard in the WHERE clause:
AND jsonb_typeof(schema->'sections') = 'array'

-- Or guard the fields access per section:
WHERE jsonb_typeof(section->'fields') = 'array'`
  },
  {
    id: 'no_transaction',
    level: 'warning',
    title: 'No transaction wrapper (BEGIN / COMMIT)',
    detect: sql => {
      const isUpdate = /UPDATE\s+["']?(?:QuoteRequests|TrTemplates)/i.test(sql);
      const hasTxn = /BEGIN\s*;/i.test(sql);
      return isUpdate && !hasTxn;
    },
    desc: 'Production UPDATEs on schema columns should always run inside an explicit transaction. Without one, you cannot ROLLBACK if a post-update check reveals bad data.',
    fix: `BEGIN;

UPDATE "QuoteRequests" SET schema = ... WHERE ...;

-- Verify: check row count or spot-inspect values here
-- SELECT COUNT(*) FROM "QuoteRequests" WHERE ...;

COMMIT;   -- or ROLLBACK if anything looks wrong`
  },
  {
    id: 'no_exists_filter',
    level: 'warning',
    title: 'No EXISTS pre-filter on target field keys',
    detect: sql => {
      const isUpdate = /UPDATE\s+["']?(?:QuoteRequests|TrTemplates)/i.test(sql);
      const hasExists = /AND\s+EXISTS\s*\(/i.test(sql);
      return isUpdate && !hasExists;
    },
    desc: "Without an EXISTS check, the UPDATE rewrites schema on every matched row, even rows that don't contain the target field keys. This risks unintended changes and extra write load.",
    fix: `AND EXISTS (
  SELECT 1
  FROM jsonb_array_elements(schema->'sections') AS sec,
       jsonb_array_elements(sec->'fields') AS fld
  WHERE fld->>'key' IN ('your_key_1', 'your_key_2')
)`
  },
  {
    id: 'chained_arrow',
    level: 'warning',
    title: 'Chained -> access without null guard',
    detect: sql => {
      const chains = (sql.match(/->'[^']+'\s*->'[^']+'/g) || []);
      const hasCoalesce = /COALESCE/i.test(sql);
      return chains.length > 0 && !hasCoalesce;
    },
    desc: "Chained JSONB access like section->'fields'->'key' returns NULL if any intermediate key is missing. Without COALESCE, this NULL propagates silently through jsonb_set and jsonb_agg calls.",
    fix: `-- Use jsonb_path_exists before deep access:
AND jsonb_path_exists(schema, '$.sections[*].fields')

-- Or guard each access level with COALESCE:
COALESCE(section->'fields', '[]'::jsonb)`
  },
  {
    id: 'no_dry_run',
    level: 'info',
    title: 'No SELECT dry-run in this file',
    detect: sql => {
      const isUpdate = /\bUPDATE\b/i.test(sql);
      const hasSelect = /\bSELECT\b/i.test(sql.replace(/jsonb_set|jsonb_agg|jsonb_array_elements|jsonb_path_exists/gi, ''));
      return isUpdate && !hasSelect;
    },
    desc: 'Before running UPDATE on production, always run an equivalent SELECT to preview which rows will be affected and what the new values will look like.',
    fix: `-- Run this SELECT before the UPDATE to verify scope:
SELECT
  id,
  "templateId",
  jsonb_array_length(schema->'sections') AS section_count,
  (SELECT COUNT(*)
   FROM jsonb_array_elements(schema->'sections') AS s,
        jsonb_array_elements(s->'fields') AS f
   WHERE f->>'key' IN ('your_key_1','your_key_2')) AS matching_fields
FROM "QuoteRequests"
WHERE "templateId" IN (925, 948)
  AND active = 1
  AND schema IS NOT NULL;`
  }
];

const BROKEN_EXAMPLE = `UPDATE "QuoteRequests" SET schema = (
  SELECT jsonb_set(
    schema,
    '{sections}',
    (
      SELECT jsonb_agg(
        jsonb_set(
          section,
          '{fields}',
          (
            SELECT jsonb_agg(
              CASE
                WHEN field->>'key' IN (
                  'XD7leM3vfx5n15QjFmka9',
                  'ZhkhZaUYoq5FmA0zhwIYY',
                  'N7qw8UEVbE5Vs0cBzv8w7'
                )
                THEN jsonb_set(field, '{visibleToSupplier}', 'false'::jsonb)
                ELSE field
              END
            )
            FROM jsonb_array_elements(section->'fields') AS field
          )
        )
      )
      FROM jsonb_array_elements(schema->'sections') AS section
    )
  )
)
WHERE "templateId" IN (925, 948)
  AND active = 1;`;

const FIXED_EXAMPLE = `BEGIN;

UPDATE "QuoteRequests"
SET schema = (
  SELECT jsonb_set(
    schema,
    '{sections}',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_set(
            section,
            '{fields}',
            COALESCE(
              (
                SELECT jsonb_agg(
                  CASE
                    WHEN field->>'key' IN (
                      'XD7leM3vfx5n15QjFmka9',
                      'ZhkhZaUYoq5FmA0zhwIYY',
                      'N7qw8UEVbE5Vs0cBzv8w7'
                    )
                    THEN jsonb_set(field, '{visibleToSupplier}', 'false'::jsonb)
                    ELSE field
                  END
                )
                FROM jsonb_array_elements(section->'fields') AS field
              ),
              section->'fields'
            )
          )
        )
        FROM jsonb_array_elements(schema->'sections') AS section
      ),
      schema->'sections'
    )
  )
)
WHERE "templateId" IN (925, 948)
  AND active = 1
  AND schema IS NOT NULL
  AND jsonb_typeof(schema->'sections') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(schema->'sections') AS sec,
         jsonb_array_elements(sec->'fields') AS fld
    WHERE fld->>'key' IN (
      'XD7leM3vfx5n15QjFmka9',
      'ZhkhZaUYoq5FmA0zhwIYY',
      'N7qw8UEVbE5Vs0cBzv8w7'
    )
    AND (fld->'visibleToSupplier')::boolean = true
  );

-- Verify row count before committing:
-- SELECT COUNT(*) FROM "QuoteRequests"
-- WHERE "templateId" IN (925, 948) AND active = 1;

COMMIT;`;

const CHECKLIST_ITEMS = [
  { title: 'Wrapped in BEGIN / COMMIT', desc: 'All production DML on schema columns must be transactional.', badge: 'critical' },
  { title: 'schema IS NOT NULL guard in WHERE', desc: 'Skip rows with null schema to prevent silent propagation.', badge: 'critical' },
  { title: 'COALESCE on every jsonb_agg()', desc: 'Fall back to the original value if aggregation returns null.', badge: 'critical' },
  { title: 'COALESCE fallback on jsonb_set value', desc: 'Preserve original field value if inner query produces null.', badge: 'critical' },
  { title: 'jsonb_typeof check before jsonb_array_elements', desc: 'Ensure sections and fields are arrays before iterating.', badge: 'important' },
  { title: 'EXISTS filter on target field keys', desc: 'Only update rows that actually contain the target keys.', badge: 'important' },
  { title: 'SELECT dry-run executed first', desc: 'Preview affected rows and values before running the UPDATE.', badge: 'important' },
  { title: 'Row count verified after UPDATE, before COMMIT', desc: 'Confirm affected row count matches expectation.', badge: 'important' },
  { title: 'Tested on staging with production-mirrored data', desc: 'Never run a novel JSONB query for the first time on prod.', badge: 'good-practice' },
  { title: 'Peer-reviewed by another developer', desc: 'A second pair of eyes catches issues you miss.', badge: 'good-practice' },
];

const PATTERNS = [
  {
    title: 'Safe nested section + field update',
    code: `BEGIN;

UPDATE "QuoteRequests"
SET schema = (
  SELECT jsonb_set(schema, '{sections}',
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_set(section, '{fields}',
          COALESCE(
            (SELECT jsonb_agg(
              CASE WHEN field->>'key' = 'target_key'
                THEN jsonb_set(field, '{visibleToSupplier}', 'false'::jsonb)
                ELSE field
              END
            ) FROM jsonb_array_elements(section->'fields') field),
            section->'fields'
          )
        )
      ) FROM jsonb_array_elements(schema->'sections') section),
      schema->'sections'
    )
  )
)
WHERE id = :id
  AND schema IS NOT NULL
  AND jsonb_typeof(schema->'sections') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(schema->'sections') s,
         jsonb_array_elements(s->'fields') f
    WHERE f->>'key' = 'target_key'
  );

COMMIT;`
  },
  {
    title: 'Dry-run SELECT before UPDATE',
    code: `-- Always run this first and verify the output
SELECT
  id,
  "templateId",
  jsonb_array_length(schema->'sections') AS section_count,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(schema->'sections') AS s,
         jsonb_array_elements(s->'fields') AS f
    WHERE f->>'key' IN ('target_key_1', 'target_key_2')
  ) AS matching_fields
FROM "QuoteRequests"
WHERE "templateId" IN (925, 948)
  AND active = 1
  AND schema IS NOT NULL;`
  },
  {
    title: 'Safe field value update using jsonb_path',
    code: `-- Use jsonb_path_exists before any deep traversal
UPDATE "TrTemplates"
SET schema = jsonb_set(
  schema,
  '{sections,0,fields,0,value}',
  '"new_value"'
)
WHERE id = :id
  AND schema IS NOT NULL
  AND jsonb_path_exists(schema, '$.sections[0].fields[0].value');`
  },
  {
    title: 'Update a single field property across all sections',
    code: `BEGIN;

UPDATE "QuoteRequests"
SET schema = (
  SELECT jsonb_set(schema, '{sections}',
    COALESCE(
      (SELECT jsonb_agg(
        CASE
          WHEN jsonb_typeof(section->'fields') = 'array'
          THEN jsonb_set(section, '{fields}',
            COALESCE(
              (SELECT jsonb_agg(
                CASE WHEN field->>'fieldId' = 'target_fieldId'
                  THEN field || '{"isLocked": true}'::jsonb
                  ELSE field
                END
              ) FROM jsonb_array_elements(section->'fields') field),
              section->'fields'
            )
          )
          ELSE section
        END
      ) FROM jsonb_array_elements(schema->'sections') section),
      schema->'sections'
    )
  )
)
WHERE schema IS NOT NULL
  AND jsonb_typeof(schema->'sections') = 'array';

COMMIT;`
  }
];
