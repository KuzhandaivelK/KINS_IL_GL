import oracledb from 'oracledb';
import { getConnection, releaseConnection } from '../config/database';
import { OracleUserRecord, CreateUserInput, UpdateUserInput, SafeUserProfile } from '../types/user';

export class UserRepository {
  /**
   * Retrieves all users (excluding passwords) with optional search filter.
   */
  async findAll(search?: string): Promise<SafeUserProfile[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      let sql = `
        SELECT 
          USER_ID,
          USER_NAME,
          USER_L1_DESC,
          NVL(USER_DISABLE_FLAG, 'N') AS USER_DISABLE_FLAG,
          NVL(USER_LOGIN_COUNT, 0) AS USER_LOGIN_COUNT,
          USER_CREATED_AT,
          USER_CREATED_BY,
          USER_MODIFIED_AT,
          USER_MODIFIED_BY
        FROM MTBL_USER
      `;

      const binds: Record<string, any> = {};

      if (search && search.trim()) {
        sql += ` WHERE LOWER(USER_ID) LIKE :search OR LOWER(USER_NAME) LIKE :search OR LOWER(USER_L1_DESC) LIKE :search`;
        binds.search = `%${search.trim().toLowerCase()}%`;
      }

      sql += ` ORDER BY USER_ID ASC`;

      const result = await connection.execute<any>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });

      if (!result.rows) {
        return [];
      }

      return result.rows.map((row) => ({
        userId: row.USER_ID,
        userName: row.USER_NAME || row.USER_ID,
        description: row.USER_L1_DESC || null,
        disableFlag: row.USER_DISABLE_FLAG || 'N',
        loginCount: row.USER_LOGIN_COUNT || 0,
        createdAt: row.USER_CREATED_AT || null,
        createdBy: row.USER_CREATED_BY || null,
        modifiedAt: row.USER_MODIFIED_AT || null,
        modifiedBy: row.USER_MODIFIED_BY || null
      }));
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Finds a user record in KINS.MTBL_USER by USER_ID using parameterized query.
   */
  async findByUserId(userId: string): Promise<OracleUserRecord | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const sql = `
        SELECT 
          USER_ID,
          USER_PASSWORD,
          USER_NAME,
          USER_L1_DESC,
          USER_DISABLE_FLAG,
          USER_LOGIN_COUNT,
          USER_CREATED_AT,
          USER_CREATED_BY,
          USER_MODIFIED_AT,
          USER_MODIFIED_BY
        FROM MTBL_USER
        WHERE USER_ID = :userId
      `;

      const result = await connection.execute<OracleUserRecord>(
        sql,
        { userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (result.rows && result.rows.length > 0) {
        return result.rows[0];
      }

      return null;
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Creates a new user record in MTBL_USER.
   */
  async create(input: CreateUserInput): Promise<SafeUserProfile> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const sql = `
        INSERT INTO MTBL_USER (
          USER_ID,
          USER_PASSWORD,
          USER_NAME,
          USER_L1_DESC,
          USER_DISABLE_FLAG,
          USER_LOGIN_COUNT,
          USER_CREATED_AT,
          USER_CREATED_BY
        ) VALUES (
          :userId,
          :password,
          :userName,
          :description,
          :disableFlag,
          0,
          SYSDATE,
          :createdBy
        )
      `;

      await connection.execute(
        sql,
        {
          userId: input.userId,
          password: input.password,
          userName: input.userName,
          description: input.description || null,
          disableFlag: input.disableFlag || 'N',
          createdBy: input.createdBy || 'admin'
        },
        { autoCommit: true }
      );

      return {
        userId: input.userId,
        userName: input.userName,
        description: input.description || null,
        disableFlag: input.disableFlag || 'N',
        loginCount: 0,
        createdAt: new Date(),
        createdBy: input.createdBy || 'admin'
      };
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Updates an existing user record in MTBL_USER.
   */
  async update(userId: string, input: UpdateUserInput): Promise<SafeUserProfile | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      // Check existence first
      const existing = await this.findByUserId(userId);
      if (!existing) {
        return null;
      }

      const updates: string[] = [];
      const binds: Record<string, any> = { userId };

      if (input.userName !== undefined) {
        updates.push(`USER_NAME = :userName`);
        binds.userName = input.userName;
      }
      if (input.description !== undefined) {
        updates.push(`USER_L1_DESC = :description`);
        binds.description = input.description;
      }
      if (input.disableFlag !== undefined) {
        updates.push(`USER_DISABLE_FLAG = :disableFlag`);
        binds.disableFlag = input.disableFlag;
      }
      if (input.password !== undefined && input.password.trim() !== '') {
        updates.push(`USER_PASSWORD = :password`);
        binds.password = input.password;
      }

      updates.push(`USER_MODIFIED_AT = SYSDATE`);
      updates.push(`USER_MODIFIED_BY = :modifiedBy`);
      binds.modifiedBy = input.modifiedBy || 'admin';

      const sql = `
        UPDATE MTBL_USER
        SET ${updates.join(', ')}
        WHERE USER_ID = :userId
      `;

      await connection.execute(sql, binds, { autoCommit: true });

      const updated = await this.findByUserId(userId);
      if (!updated) return null;

      return {
        userId: updated.USER_ID,
        userName: updated.USER_NAME || updated.USER_ID,
        description: updated.USER_L1_DESC || null,
        disableFlag: updated.USER_DISABLE_FLAG || 'N',
        loginCount: updated.USER_LOGIN_COUNT || 0,
        createdAt: updated.USER_CREATED_AT || null,
        createdBy: updated.USER_CREATED_BY || null,
        modifiedAt: updated.USER_MODIFIED_AT || null,
        modifiedBy: updated.USER_MODIFIED_BY || null
      };
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Deletes a user record by USER_ID.
   */
  async delete(userId: string): Promise<boolean> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const sql = `DELETE FROM MTBL_USER WHERE USER_ID = :userId`;
      const result = await connection.execute(sql, { userId }, { autoCommit: true });

      return (result.rowsAffected || 0) > 0;
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Updates login count and last modified timestamp on successful login.
   */
  async incrementLoginCount(userId: string): Promise<void> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const sql = `
        UPDATE MTBL_USER
        SET 
          USER_LOGIN_COUNT = NVL(USER_LOGIN_COUNT, 0) + 1,
          USER_MODIFIED_AT = SYSDATE,
          USER_MODIFIED_BY = :userId
        WHERE USER_ID = :userId
      `;

      await connection.execute(
        sql,
        { userId },
        { autoCommit: true }
      );
    } catch (err) {
      console.warn('[UserRepository] Warning: Could not increment login count:', err);
    } finally {
      await releaseConnection(connection);
    }
  }
}

export const userRepository = new UserRepository();
