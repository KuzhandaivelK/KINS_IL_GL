-- =============================================================================
-- LIFE INSURANCE CORE SYSTEM - PHASE 1
-- DATABASE INSPECTION SCRIPT: KINS.MTBL_USER
-- =============================================================================
-- Purpose: Inspect existing authentication table structure, columns, constraints,
--          indexes, and account status flags in the KINS schema without exposing
--          sensitive passwords or hashes.
-- =============================================================================

SET DEFINE OFF;
SET LINESIZE 250;
SET PAGESIZE 200;
SET COLSEP ' | ';
SET FEEDBACK OFF;
SET ECHO OFF;

PROMPT =====================================================================
PROMPT 1. TABLE COLUMN DEFINITIONS (KINS.MTBL_USER)
PROMPT =====================================================================
COL COLUMN_ID FORMAT 999 HEADING "Col#"
COL COLUMN_NAME FORMAT A25 HEADING "Column Name"
COL DATA_TYPE FORMAT A15 HEADING "Data Type"
COL DATA_LENGTH FORMAT 99999 HEADING "Length"
COL DATA_PRECISION FORMAT 99999 HEADING "Precision"
COL DATA_SCALE FORMAT 99999 HEADING "Scale"
COL NULLABLE FORMAT A8 HEADING "Nullable"

SELECT 
    COLUMN_ID,
    COLUMN_NAME,
    DATA_TYPE,
    DATA_LENGTH,
    DATA_PRECISION,
    DATA_SCALE,
    NULLABLE
FROM ALL_TAB_COLUMNS
WHERE OWNER = 'KINS' 
  AND TABLE_NAME = 'MTBL_USER'
ORDER BY COLUMN_ID;

PROMPT 
PROMPT =====================================================================
PROMPT 2. CONSTRAINTS & KEYS (KINS.MTBL_USER)
PROMPT =====================================================================
COL CONSTRAINT_NAME FORMAT A25 HEADING "Constraint Name"
COL CONSTRAINT_TYPE FORMAT A15 HEADING "Type"
COL STATUS FORMAT A10 HEADING "Status"
COL COLUMN_NAME FORMAT A25 HEADING "Column Name"
COL POSITION FORMAT 999 HEADING "Pos"

SELECT 
    c.CONSTRAINT_NAME,
    CASE c.CONSTRAINT_TYPE 
        WHEN 'P' THEN 'PRIMARY KEY'
        WHEN 'R' THEN 'FOREIGN KEY'
        WHEN 'U' THEN 'UNIQUE'
        WHEN 'C' THEN 'CHECK'
        ELSE c.CONSTRAINT_TYPE 
    END AS CONSTRAINT_TYPE,
    c.STATUS,
    cc.COLUMN_NAME,
    cc.POSITION
FROM ALL_CONSTRAINTS c
LEFT JOIN ALL_CONS_COLUMNS cc 
  ON c.OWNER = cc.OWNER 
 AND c.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
WHERE c.OWNER = 'KINS' 
  AND c.TABLE_NAME = 'MTBL_USER'
ORDER BY c.CONSTRAINT_TYPE, c.CONSTRAINT_NAME, cc.POSITION;

PROMPT 
PROMPT =====================================================================
PROMPT 3. INDEXES (KINS.MTBL_USER)
PROMPT =====================================================================
COL INDEX_NAME FORMAT A30 HEADING "Index Name"
COL UNIQUENESS FORMAT A15 HEADING "Uniqueness"

SELECT INDEX_NAME, UNIQUENESS, STATUS
FROM ALL_INDEXES
WHERE OWNER = 'KINS' 
  AND TABLE_NAME = 'MTBL_USER';

PROMPT 
PROMPT =====================================================================
PROMPT 4. ACCOUNT STATUS & DISABLE FLAGS
PROMPT =====================================================================
SELECT 
    NVL(USER_DISABLE_FLAG, 'NULL') AS USER_DISABLE_FLAG,
    COUNT(*) AS TOTAL_USERS
FROM KINS.MTBL_USER
GROUP BY USER_DISABLE_FLAG;

PROMPT 
PROMPT =====================================================================
PROMPT 5. PASSWORD STORAGE CHARACTERISTICS (SAFE METADATA - NO PASSWORDS)
PROMPT =====================================================================
COL PWD_LEN FORMAT 9999 HEADING "Length"
COL STORAGE_TYPE FORMAT A25 HEADING "Detected Format"
COL RECS FORMAT 9999 HEADING "Record Count"

SELECT 
    LENGTH(USER_PASSWORD) AS PWD_LEN,
    CASE 
        WHEN SUBSTR(USER_PASSWORD, 1, 3) IN ('$2a', '$2b', '$2y') AND LENGTH(USER_PASSWORD) = 60 THEN 'BCRYPT HASH (60 CHARS)'
        WHEN REGEXP_LIKE(USER_PASSWORD, '^[0-9a-fA-F]{32}$') THEN 'MD5 HASH (32 HEX)'
        WHEN REGEXP_LIKE(USER_PASSWORD, '^[0-9a-fA-F]{40}$') THEN 'SHA-1 HASH (40 HEX)'
        WHEN REGEXP_LIKE(USER_PASSWORD, '^[0-9a-fA-F]{64}$') THEN 'SHA-256 HASH (64 HEX)'
        ELSE 'STANDARD STRING / LEGACY'
    END AS STORAGE_TYPE,
    COUNT(*) AS RECS
FROM KINS.MTBL_USER
GROUP BY LENGTH(USER_PASSWORD),
    CASE 
        WHEN SUBSTR(USER_PASSWORD, 1, 3) IN ('$2a', '$2b', '$2y') AND LENGTH(USER_PASSWORD) = 60 THEN 'BCRYPT HASH (60 CHARS)'
        WHEN REGEXP_LIKE(USER_PASSWORD, '^[0-9a-fA-F]{32}$') THEN 'MD5 HASH (32 HEX)'
        WHEN REGEXP_LIKE(USER_PASSWORD, '^[0-9a-fA-F]{40}$') THEN 'SHA-1 HASH (40 HEX)'
        WHEN REGEXP_LIKE(USER_PASSWORD, '^[0-9a-fA-F]{64}$') THEN 'SHA-256 HASH (64 HEX)'
        ELSE 'STANDARD STRING / LEGACY'
    END;

PROMPT 
PROMPT =====================================================================
PROMPT 6. SAFE USER LIST (EXCLUDING PASSWORDS)
PROMPT =====================================================================
COL USER_ID FORMAT A20 HEADING "User ID"
COL USER_NAME FORMAT A30 HEADING "User Name"
COL USER_DISABLE_FLAG FORMAT A12 HEADING "Disabled?"
COL USER_LOGIN_COUNT FORMAT 9999 HEADING "Login Count"

SELECT 
    USER_ID, 
    USER_NAME, 
    NVL(USER_DISABLE_FLAG, 'N') AS USER_DISABLE_FLAG, 
    NVL(USER_LOGIN_COUNT, 0) AS USER_LOGIN_COUNT
FROM KINS.MTBL_USER;

EXIT;
