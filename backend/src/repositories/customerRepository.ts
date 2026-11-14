import oracledb from 'oracledb';
import { getConnection, releaseConnection } from '../config/database';
import { OracleCustomerRecord, CreateCustomerInput, UpdateCustomerInput, CustomerListItem } from '../types/customer';

export class CustomerRepository {
  /**
   * Retrieves all customers with optional search filter.
   */
  async findAll(search?: string): Promise<CustomerListItem[]> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      let sql = `
        SELECT 
          CUST_CODE,
          CUST_NAME,
          CUST_CATEGORY,
          CUST_ADDRESS,
          CUST_MOBILE,
          CUST_EMAIL,
          NVL(CUST_STATUS, 'Y') AS CUST_STATUS,
          CUST_CREATED_AT,
          CUST_CREATED_BY,
          CUST_MODIFIED_AT,
          CUST_MODIFIED_BY
        FROM MTBL_CUSTOMER
      `;

      const binds: Record<string, any> = {};

      if (search && search.trim()) {
        sql += ` WHERE LOWER(CUST_CODE) LIKE :search OR LOWER(CUST_NAME) LIKE :search OR LOWER(CUST_EMAIL) LIKE :search`;
        binds.search = `%${search.trim().toLowerCase()}%`;
      }

      sql += ` ORDER BY CUST_CODE ASC`;

      const result = await connection.execute<any>(sql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      });

      if (!result.rows) {
        return [];
      }

      return result.rows.map((row) => ({
        customerId: row.CUST_CODE,
        customerName: row.CUST_NAME || row.CUST_CODE,
        customerType: row.CUST_CATEGORY || null,
        address: row.CUST_ADDRESS || null,
        phone: row.CUST_MOBILE ? String(row.CUST_MOBILE) : null,
        email: row.CUST_EMAIL || null,
        status: (row.CUST_STATUS === 'N' ? 'N' : 'Y') as 'Y' | 'N',
        createdAt: row.CUST_CREATED_AT || null,
        createdBy: row.CUST_CREATED_BY || null,
        modifiedAt: row.CUST_MODIFIED_AT || null,
        modifiedBy: row.CUST_MODIFIED_BY || null
      }));
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Finds customer by CUST_CODE
   */
  async findByCustomerId(customerId: string): Promise<OracleCustomerRecord | null> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const sql = `
        SELECT 
          CUST_CODE,
          CUST_NAME,
          CUST_CATEGORY,
          CUST_ADDRESS,
          CUST_MOBILE,
          CUST_EMAIL,
          NVL(CUST_STATUS, 'Y') AS CUST_STATUS,
          CUST_CREATED_AT,
          CUST_CREATED_BY,
          CUST_MODIFIED_AT,
          CUST_MODIFIED_BY
        FROM MTBL_CUSTOMER
        WHERE CUST_CODE = :customerId
      `;

      const result = await connection.execute<OracleCustomerRecord>(
        sql,
        { customerId },
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
   * Creates a new customer in MTBL_CUSTOMER
   */
  async create(input: CreateCustomerInput): Promise<CustomerListItem> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const sql = `
        INSERT INTO MTBL_CUSTOMER (
          CUST_CODE,
          CUST_NAME,
          CUST_CATEGORY,
          CUST_ADDRESS,
          CUST_MOBILE,
          CUST_EMAIL,
          CUST_STATUS,
          CUST_CREATED_AT,
          CUST_CREATED_BY
        ) VALUES (
          :customerId,
          :customerName,
          :customerType,
          :address,
          :phone,
          :email,
          :status,
          SYSDATE,
          :createdBy
        )
      `;

      await connection.execute(
        sql,
        {
          customerId: input.customerId,
          customerName: input.customerName,
          customerType: input.customerType || null,
          address: input.address || null,
          phone: input.phone || null,
          email: input.email || null,
          status: input.status || 'Y',
          createdBy: input.createdBy || 'admin'
        },
        { autoCommit: true }
      );

      return {
        customerId: input.customerId,
        customerName: input.customerName,
        customerType: input.customerType || null,
        address: input.address || null,
        phone: input.phone || null,
        email: input.email || null,
        status: input.status || 'Y',
        createdAt: new Date(),
        createdBy: input.createdBy || 'admin'
      };
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Updates an existing customer in MTBL_CUSTOMER
   */
  async update(customerId: string, input: UpdateCustomerInput): Promise<CustomerListItem> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const setClauses: string[] = ['CUST_MODIFIED_AT = SYSDATE', 'CUST_MODIFIED_BY = :modifiedBy'];
      const binds: Record<string, any> = {
        customerId,
        modifiedBy: input.modifiedBy || 'admin'
      };

      if (input.customerName !== undefined) {
        setClauses.push('CUST_NAME = :customerName');
        binds.customerName = input.customerName;
      }

      if (input.customerType !== undefined) {
        setClauses.push('CUST_CATEGORY = :customerType');
        binds.customerType = input.customerType;
      }

      if (input.address !== undefined) {
        setClauses.push('CUST_ADDRESS = :address');
        binds.address = input.address;
      }

      if (input.phone !== undefined) {
        setClauses.push('CUST_MOBILE = :phone');
        binds.phone = input.phone;
      }

      if (input.email !== undefined) {
        setClauses.push('CUST_EMAIL = :email');
        binds.email = input.email;
      }

      if (input.status !== undefined) {
        setClauses.push('CUST_STATUS = :status');
        binds.status = input.status;
      }

      const sql = `
        UPDATE MTBL_CUSTOMER
        SET ${setClauses.join(', ')}
        WHERE CUST_CODE = :customerId
      `;

      await connection.execute(sql, binds, { autoCommit: true });

      const updated = await this.findByCustomerId(customerId);
      if (!updated) {
        throw new Error(`Customer '${customerId}' not found after update`);
      }

      return {
        customerId: updated.CUST_CODE,
        customerName: updated.CUST_NAME || updated.CUST_CODE,
        customerType: updated.CUST_CATEGORY || null,
        address: updated.CUST_ADDRESS || null,
        phone: updated.CUST_MOBILE ? String(updated.CUST_MOBILE) : null,
        email: updated.CUST_EMAIL || null,
        status: (updated.CUST_STATUS === 'N' ? 'N' : 'Y') as 'Y' | 'N',
        createdAt: updated.CUST_CREATED_AT || null,
        createdBy: updated.CUST_CREATED_BY || null,
        modifiedAt: updated.CUST_MODIFIED_AT || null,
        modifiedBy: updated.CUST_MODIFIED_BY || null
      };
    } finally {
      await releaseConnection(connection);
    }
  }

  /**
   * Deletes a customer from MTBL_CUSTOMER
   */
  async delete(customerId: string): Promise<boolean> {
    let connection: oracledb.Connection | null = null;
    try {
      connection = await getConnection();

      const sql = `DELETE FROM MTBL_CUSTOMER WHERE CUST_CODE = :customerId`;
      const result = await connection.execute(sql, { customerId }, { autoCommit: true });

      return (result.rowsAffected || 0) > 0;
    } finally {
      await releaseConnection(connection);
    }
  }
}

export const customerRepository = new CustomerRepository();
