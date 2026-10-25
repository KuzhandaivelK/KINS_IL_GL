import oracledb from 'oracledb';
import { env } from './env';

const POOL_ALIAS = 'kins_pool';

// Configure oracledb defaults
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = true;

let poolInitialized = false;

/**
 * Initializes the Oracle connection pool using configured credentials
 */
export async function initializeDatabasePool(): Promise<void> {
  if (poolInitialized) {
    return;
  }

  try {
    await oracledb.createPool({
      poolAlias: POOL_ALIAS,
      user: env.ORACLE_USER,
      password: env.ORACLE_PASSWORD,
      connectString: env.ORACLE_CONNECT_STRING,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 2,
      poolTimeout: 60,
      enableStatistics: false
    });

    poolInitialized = true;
    console.log(`[Database] Oracle connection pool successfully initialized for user '${env.ORACLE_USER}' on '${env.ORACLE_CONNECT_STRING}'.`);
  } catch (error: any) {
    console.error('[Database] Failed to initialize Oracle connection pool:', error?.message || error);
    throw error;
  }
}

/**
 * Retrieves a database connection from the pool.
 * Caller MUST release the connection in a finally block.
 */
export async function getConnection(): Promise<oracledb.Connection> {
  try {
    return await oracledb.getConnection(POOL_ALIAS);
  } catch (error: any) {
    // If pool is not initialized yet, attempt on-demand initialization
    if (!poolInitialized) {
      await initializeDatabasePool();
      return await oracledb.getConnection(POOL_ALIAS);
    }
    console.error('[Database] Error acquiring connection from pool:', error?.message || error);
    throw error;
  }
}

/**
 * Safely releases a connection back to the pool
 */
export async function releaseConnection(conn: oracledb.Connection | null | undefined): Promise<void> {
  if (conn) {
    try {
      await conn.close();
    } catch (err: any) {
      console.error('[Database] Error closing Oracle connection:', err?.message || err);
    }
  }
}

/**
 * Closes the connection pool on application shutdown
 */
export async function closeDatabasePool(): Promise<void> {
  if (poolInitialized) {
    try {
      await oracledb.getPool(POOL_ALIAS).close(10);
      poolInitialized = false;
      console.log('[Database] Oracle connection pool closed gracefully.');
    } catch (error: any) {
      console.error('[Database] Error closing Oracle connection pool:', error?.message || error);
    }
  }
}

/**
 * Checks database connectivity for health check endpoints
 */
export async function checkDatabaseHealth(): Promise<{ status: 'UP' | 'DOWN'; message: string }> {
  let conn: oracledb.Connection | null = null;
  try {
    conn = await getConnection();
    const result = await conn.execute<{ STATUS: number }>('SELECT 1 AS STATUS FROM DUAL');
    if (result.rows && result.rows.length > 0) {
      return { status: 'UP', message: 'Oracle 19c database connection is active' };
    }
    return { status: 'DOWN', message: 'Unexpected response from database' };
  } catch (err: any) {
    return { status: 'DOWN', message: 'Database connection failed' };
  } finally {
    await releaseConnection(conn);
  }
}
