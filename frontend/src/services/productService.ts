import {
  ProductItem,
  ProductDetail,
  ProductFormData,
  ProductApiResponse
} from '../types/product';

const API_BASE_URL = '/api/products';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
  const token = localStorage.getItem('kins_auth_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const productService = {
  /**
   * Fetch all products with optional filters
   */
  async getProducts(search?: string, prodType?: string): Promise<ProductApiResponse<ProductItem>> {
    const params = new URLSearchParams();
    if (search && search.trim() !== '') params.append('search', search.trim());
    if (prodType && prodType.trim() !== '') params.append('prodType', prodType.trim());

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}${queryString}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Server returned unexpected response (status ${res.status})`);
    }

    const data: ProductApiResponse<ProductItem> = await res.json();
    return data;
  },

  /**
   * Fetch a single product by code with its attached covers
   */
  async getProductByCode(prodCode: string): Promise<ProductApiResponse<ProductDetail>> {
    const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(prodCode)}`, {
      method: 'GET',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Server returned unexpected response (status ${res.status})`);
    }

    const data: ProductApiResponse<ProductDetail> = await res.json();
    return data;
  },

  /**
   * Create a new product with attached covers
   */
  async createProduct(formData: ProductFormData): Promise<ProductApiResponse<ProductDetail>> {
    const payload = {
      PROD_CODE: formData.PROD_CODE.trim().toUpperCase(),
      PROD_NAME: formData.PROD_NAME.trim(),
      PROD_TYPE: formData.PROD_TYPE || 'T',
      PROD_TERM_FM: formData.PROD_TERM_FM === '' ? null : Number(formData.PROD_TERM_FM),
      PROD_TERM_TO: formData.PROD_TERM_TO === '' ? null : Number(formData.PROD_TERM_TO),
      PROD_MIN_AGE: formData.PROD_MIN_AGE === '' ? null : Number(formData.PROD_MIN_AGE),
      PROD_MAX_AGE: formData.PROD_MAX_AGE === '' ? null : Number(formData.PROD_MAX_AGE),
      PROD_AGE_CALC_MTHD: formData.PROD_AGE_CALC_MTHD || 'ANB',
      PROD_JOINT_LIFE_YN: formData.PROD_JOINT_LIFE_YN || 'N',
      PROD_PERIOD_MULTIPLE: formData.PROD_PERIOD_MULTIPLE === '' ? 1 : Number(formData.PROD_PERIOD_MULTIPLE),
      PROD_VALID_FM_DT: formData.PROD_VALID_FM_DT || null,
      PROD_VALID_TO_DT: formData.PROD_VALID_TO_DT || null,
      PROD_COOLOFF_DAYS: formData.PROD_COOLOFF_DAYS === '' ? 15 : Number(formData.PROD_COOLOFF_DAYS),
      PROD_MIN_SA: formData.PROD_MIN_SA === '' ? null : Number(formData.PROD_MIN_SA),
      PROD_MAX_SA: formData.PROD_MAX_SA === '' ? null : Number(formData.PROD_MAX_SA),
      PROD_COMM_CODE: formData.PROD_COMM_CODE.trim() || null,
      PROD_SURR_YN: formData.PROD_SURR_YN || 'N',
      PROD_SURR_YEARS: formData.PROD_SURR_YEARS === '' ? null : Number(formData.PROD_SURR_YEARS),
      PROD_LOAN_YN: formData.PROD_LOAN_YN || 'N',
      PROD_MAT_YN: formData.PROD_MAT_YN || 'N',
      PROD_WITHDRAW_YN: formData.PROD_WITHDRAW_YN || 'N',
      covers: formData.covers.map((c) => ({
        MPC_COVER_CODE: c.MPC_COVER_CODE,
        MPC_DEFAULT_YN: c.MPC_DEFAULT_YN,
        MPC_MANDATORY_YN: c.MPC_MANDATORY_YN,
        MPC_MAX_AGE_ON_MAT: c.MPC_MAX_AGE_ON_MAT === null || c.MPC_MAX_AGE_ON_MAT === undefined ? null : Number(c.MPC_MAX_AGE_ON_MAT),
        MPC_PERIOD: c.MPC_PERIOD === null || c.MPC_PERIOD === undefined ? null : Number(c.MPC_PERIOD),
        MPC_PREM_PAY_YRS: c.MPC_PREM_PAY_YRS === null || c.MPC_PREM_PAY_YRS === undefined ? null : Number(c.MPC_PREM_PAY_YRS)
      }))
    };

    const res = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const data: ProductApiResponse<ProductDetail> = await res.json();
    return data;
  },

  /**
   * Update an existing product and its attached covers
   */
  async updateProduct(prodCode: string, formData: ProductFormData): Promise<ProductApiResponse<ProductDetail>> {
    const payload = {
      PROD_NAME: formData.PROD_NAME.trim(),
      PROD_TYPE: formData.PROD_TYPE || 'T',
      PROD_TERM_FM: formData.PROD_TERM_FM === '' ? null : Number(formData.PROD_TERM_FM),
      PROD_TERM_TO: formData.PROD_TERM_TO === '' ? null : Number(formData.PROD_TERM_TO),
      PROD_MIN_AGE: formData.PROD_MIN_AGE === '' ? null : Number(formData.PROD_MIN_AGE),
      PROD_MAX_AGE: formData.PROD_MAX_AGE === '' ? null : Number(formData.PROD_MAX_AGE),
      PROD_AGE_CALC_MTHD: formData.PROD_AGE_CALC_MTHD || 'ANB',
      PROD_JOINT_LIFE_YN: formData.PROD_JOINT_LIFE_YN || 'N',
      PROD_PERIOD_MULTIPLE: formData.PROD_PERIOD_MULTIPLE === '' ? 1 : Number(formData.PROD_PERIOD_MULTIPLE),
      PROD_VALID_FM_DT: formData.PROD_VALID_FM_DT || null,
      PROD_VALID_TO_DT: formData.PROD_VALID_TO_DT || null,
      PROD_COOLOFF_DAYS: formData.PROD_COOLOFF_DAYS === '' ? 15 : Number(formData.PROD_COOLOFF_DAYS),
      PROD_MIN_SA: formData.PROD_MIN_SA === '' ? null : Number(formData.PROD_MIN_SA),
      PROD_MAX_SA: formData.PROD_MAX_SA === '' ? null : Number(formData.PROD_MAX_SA),
      PROD_COMM_CODE: formData.PROD_COMM_CODE.trim() || null,
      PROD_SURR_YN: formData.PROD_SURR_YN || 'N',
      PROD_SURR_YEARS: formData.PROD_SURR_YEARS === '' ? null : Number(formData.PROD_SURR_YEARS),
      PROD_LOAN_YN: formData.PROD_LOAN_YN || 'N',
      PROD_MAT_YN: formData.PROD_MAT_YN || 'N',
      PROD_WITHDRAW_YN: formData.PROD_WITHDRAW_YN || 'N',
      covers: formData.covers.map((c) => ({
        MPC_COVER_CODE: c.MPC_COVER_CODE,
        MPC_DEFAULT_YN: c.MPC_DEFAULT_YN,
        MPC_MANDATORY_YN: c.MPC_MANDATORY_YN,
        MPC_MAX_AGE_ON_MAT: c.MPC_MAX_AGE_ON_MAT === null || c.MPC_MAX_AGE_ON_MAT === undefined ? null : Number(c.MPC_MAX_AGE_ON_MAT),
        MPC_PERIOD: c.MPC_PERIOD === null || c.MPC_PERIOD === undefined ? null : Number(c.MPC_PERIOD),
        MPC_PREM_PAY_YRS: c.MPC_PREM_PAY_YRS === null || c.MPC_PREM_PAY_YRS === undefined ? null : Number(c.MPC_PREM_PAY_YRS)
      }))
    };

    const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(prodCode)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    const data: ProductApiResponse<ProductDetail> = await res.json();
    return data;
  },

  /**
   * Delete a product and its covers
   */
  async deleteProduct(prodCode: string): Promise<ProductApiResponse<never>> {
    const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(prodCode)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include'
    });

    const data: ProductApiResponse<never> = await res.json();
    return data;
  }
};
