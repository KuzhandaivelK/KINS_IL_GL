import * as XLSX from 'xlsx';

export interface ParsedMemberRow {
  rowNumber: number;
  empId: string;
  memberName: string;
  dob: string; // YYYY-MM-DD
  age: number;
  gender: 'M' | 'F' | 'O';
  category: string;
  monthlySalary: number;
  annualSalary: number;
  sumAssured?: number;
  status: 'VALID' | 'WARNING' | 'ERROR';
  validationMessage?: string;
}

export interface MemberUploadResult {
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  warningRowsCount: number;
  members: ParsedMemberRow[];
  errors: Array<{ row: number; empId?: string; message: string }>;
}

/**
 * Format Date to YYYY-MM-DD safely
 */
function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculate age based on YYYY-MM-DD
 */
export function calculateAge(dobStr: string): number {
  if (!dobStr) return 30;
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return 30;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : 30;
}

/**
 * Parse varied date inputs (Excel serial number, ISO, DD/MM/YYYY, etc.)
 */
function parseDateValue(val: any): string | null {
  if (!val) return null;

  // 1. If it's already a JS Date object
  if (val instanceof Date && !isNaN(val.getTime())) {
    return formatDate(val);
  }

  // 2. If it's a number (Excel date serial)
  if (typeof val === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed) {
        const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
        if (!isNaN(d.getTime())) {
          return formatDate(d);
        }
      }
    } catch {
      // Fallback: Excel serial date formula
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) {
        return formatDate(d);
      }
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  // 3. Match YYYY-MM-DD or YYYY/MM/DD
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(str)) {
    const parts = str.split(/[-/.]/);
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) return formatDate(d);
  }

  // 4. Match DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(str)) {
    const parts = str.split(/[-/.]/);
    const day = Number(parts[0]);
    const month = Number(parts[1]);
    const year = Number(parts[2]);
    const d = new Date(year, month - 1, day);
    if (!isNaN(d.getTime())) return formatDate(d);
  }

  // 5. General Date parse
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1920 && d.getFullYear() <= new Date().getFullYear()) {
    return formatDate(d);
  }

  return null;
}

/**
 * Normalize gender string to M / F / O
 */
function normalizeGender(val: any): 'M' | 'F' | 'O' {
  if (!val) return 'M';
  const g = String(val).trim().toUpperCase();
  if (g.startsWith('M') || g === '1' || g === 'MALE' || g === 'BOY') return 'M';
  if (g.startsWith('F') || g === '2' || g === 'FEMALE' || g === 'GIRL') return 'F';
  return 'O';
}

/**
 * Clean column header key to find matched field
 */
function cleanKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Map raw row headers to standard member attributes
 */
function mapRowToMember(raw: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(raw)) {
    const clean = cleanKey(key);

    if (['empid', 'employeeid', 'staffid', 'id', 'empno', 'code', 'employeecode'].includes(clean)) {
      result.empId = value;
    } else if (['membername', 'name', 'employeename', 'fullname', 'staffname'].includes(clean)) {
      result.memberName = value;
    } else if (['dob', 'dateofbirth', 'birthdate', 'birthofdate'].includes(clean)) {
      result.dob = value;
    } else if (['gender', 'sex'].includes(clean)) {
      result.gender = value;
    } else if (['category', 'grade', 'designation', 'role', 'department', 'jobtitle'].includes(clean)) {
      result.category = value;
    } else if (['monthlysalary', 'salary', 'basicsalary', 'monthlywage', 'wages'].includes(clean)) {
      result.monthlySalary = value;
    } else if (['annualsalary', 'yearlysalary', 'annualwage'].includes(clean)) {
      result.annualSalary = value;
    } else if (['sumassured', 'sa', 'cover', 'lifecover', 'sumassuredomr'].includes(clean)) {
      result.sumAssured = value;
    }
  }

  return result;
}

/**
 * Parse CSV or Excel buffer into standardized Member Census array
 */
export function parseMemberFileBuffer(fileBuffer: Buffer, fileName: string): MemberUploadResult {
  const isCsv = fileName.toLowerCase().endsWith('.csv');

  let workbook: XLSX.WorkBook;
  if (isCsv) {
    const csvContent = fileBuffer.toString('utf-8');
    workbook = XLSX.read(csvContent, { type: 'string', cellDates: true });
  } else {
    workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('The uploaded file does not contain any readable worksheet.');
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: true
  });

  if (rawRows.length === 0) {
    throw new Error('The uploaded file is empty. Please ensure the template contains employee rows.');
  }

  const members: ParsedMemberRow[] = [];
  const errors: Array<{ row: number; empId?: string; message: string }> = [];

  rawRows.forEach((raw, idx) => {
    const rowNum = idx + 2; // header is row 1, data starts at row 2
    const mapped = mapRowToMember(raw);

    const empId = mapped.empId ? String(mapped.empId).trim() : `EMP-${1000 + idx + 1}`;
    const memberName = mapped.memberName ? String(mapped.memberName).trim() : '';
    const rawDob = mapped.dob;
    const dob = parseDateValue(rawDob);
    const gender = normalizeGender(mapped.gender);
    const category = mapped.category ? String(mapped.category).trim() : 'STAFF';

    const numMonthly = Number(String(mapped.monthlySalary || '').replace(/[^0-9.]/g, '')) || 0;
    const numAnnual = Number(String(mapped.annualSalary || '').replace(/[^0-9.]/g, '')) || (numMonthly * 12);
    const numSa = mapped.sumAssured ? Number(String(mapped.sumAssured).replace(/[^0-9.]/g, '')) : undefined;

    let status: 'VALID' | 'WARNING' | 'ERROR' = 'VALID';
    const validationMessages: string[] = [];

    // Validation checks
    if (!memberName) {
      status = 'ERROR';
      validationMessages.push('Member name is required');
    }

    if (!dob) {
      status = 'ERROR';
      validationMessages.push(`Invalid date of birth: "${rawDob || 'empty'}"`);
    }

    const age = dob ? calculateAge(dob) : 30;
    if (age < 18) {
      status = status === 'ERROR' ? 'ERROR' : 'WARNING';
      validationMessages.push(`Underage employee (${age} yrs)`);
    } else if (age > 70) {
      status = status === 'ERROR' ? 'ERROR' : 'WARNING';
      validationMessages.push(`Over-age employee (${age} yrs, standard retirement limit is 65/70)`);
    }

    if (numMonthly <= 0 && (!numSa || numSa <= 0)) {
      status = status === 'ERROR' ? 'ERROR' : 'WARNING';
      validationMessages.push('Salary or Sum Assured is zero or unspecified');
    }

    const rowObj: ParsedMemberRow = {
      rowNumber: rowNum,
      empId,
      memberName: memberName || `Employee ${rowNum - 1}`,
      dob: dob || '1990-01-01',
      age,
      gender,
      category,
      monthlySalary: numMonthly,
      annualSalary: numAnnual,
      sumAssured: numSa,
      status,
      validationMessage: validationMessages.join('; ') || undefined
    };

    if (status === 'ERROR') {
      errors.push({
        row: rowNum,
        empId,
        message: rowObj.validationMessage || 'Invalid member details'
      });
    }

    members.push(rowObj);
  });

  const validRowsCount = members.filter(m => m.status === 'VALID').length;
  const warningRowsCount = members.filter(m => m.status === 'WARNING').length;
  const errorRowsCount = members.filter(m => m.status === 'ERROR').length;

  return {
    totalRows: members.length,
    validRowsCount,
    warningRowsCount,
    errorRowsCount,
    members,
    errors
  };
}

/**
 * Generate Sample Template Excel workbook buffer
 */
export function generateSampleExcelBuffer(): Buffer {
  const wb = XLSX.utils.book_new();

  const headers = [
    'EMP_ID',
    'MEMBER_NAME',
    'DOB',
    'GENDER',
    'CATEGORY',
    'MONTHLY_SALARY',
    'ANNUAL_SALARY',
    'SUM_ASSURED'
  ];

  const sampleData = [
    headers,
    ['EMP-1001', 'Ahmed Al-Harthy', '1979-04-15', 'M', 'Executive', 4500, 54000, 162000],
    ['EMP-1002', 'Fatima Al-Balushi', '1986-09-22', 'F', 'Management', 3200, 38400, 115200],
    ['EMP-1003', 'Salim Al-Kiyumi', '1992-02-10', 'M', 'Staff', 1800, 21600, 64800],
    ['EMP-1004', 'Maryam Al-Zadjali', '1995-11-05', 'F', 'Staff', 1600, 19200, 57600],
    ['EMP-1005', 'Rashid Al-Habsi', '1983-07-30', 'M', 'Technical', 2400, 28800, 86400],
    ['EMP-1006', 'Khalid Al-Raisi', '1998-03-14', 'M', 'Staff', 1400, 16800, 50400],
    ['EMP-1007', 'Mona Al-Fazari', '1991-08-20', 'F', 'Management', 2800, 33600, 100800]
  ];

  const ws = XLSX.utils.aoa_to_sheet(sampleData);

  // Set column widths
  ws['!cols'] = [
    { wch: 12 }, // EMP_ID
    { wch: 24 }, // MEMBER_NAME
    { wch: 14 }, // DOB
    { wch: 10 }, // GENDER
    { wch: 16 }, // CATEGORY
    { wch: 18 }, // MONTHLY_SALARY
    { wch: 18 }, // ANNUAL_SALARY
    { wch: 18 }  // SUM_ASSURED
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Member Census Template');

  // Instructions sheet
  const instructions = [
    ['GROUP LIFE MEMBER CENSUS UPLOAD INSTRUCTIONS'],
    [''],
    ['Field Name', 'Required', 'Accepted Formats / Values', 'Description'],
    ['EMP_ID', 'Yes', 'Text (e.g. EMP-1001)', 'Unique employee or staff reference code'],
    ['MEMBER_NAME', 'Yes', 'Text', 'Full legal name of the insured employee'],
    ['DOB', 'Yes', 'YYYY-MM-DD or DD/MM/YYYY', 'Date of birth for actuarial mortality rating and age calculation'],
    ['GENDER', 'Yes', 'M / F / O (or Male / Female)', 'Gender of member'],
    ['CATEGORY', 'Optional', 'Text (e.g. Executive, Staff)', 'Employee grading or job category'],
    ['MONTHLY_SALARY', 'Conditional', 'Number (e.g. 2500)', 'Basic monthly wage in local currency; used for multiple-of-salary SA formulas'],
    ['ANNUAL_SALARY', 'Optional', 'Number (e.g. 30000)', 'Auto-calculated as Monthly Salary x 12 if left blank'],
    ['SUM_ASSURED', 'Optional', 'Number (e.g. 90000)', 'Override Sum Assured; if omitted, automatically computed from scheme formula']
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 30 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate Sample Template CSV string
 */
export function generateSampleCsvString(): string {
  const rows = [
    ['EMP_ID', 'MEMBER_NAME', 'DOB', 'GENDER', 'CATEGORY', 'MONTHLY_SALARY', 'ANNUAL_SALARY', 'SUM_ASSURED'],
    ['EMP-1001', 'Ahmed Al-Harthy', '1979-04-15', 'M', 'Executive', '4500', '54000', '162000'],
    ['EMP-1002', 'Fatima Al-Balushi', '1986-09-22', 'F', 'Management', '3200', '38400', '115200'],
    ['EMP-1003', 'Salim Al-Kiyumi', '1992-02-10', 'M', 'Staff', '1800', '21600', '64800'],
    ['EMP-1004', 'Maryam Al-Zadjali', '1995-11-05', 'F', 'Staff', '1600', '19200', '57600'],
    ['EMP-1005', 'Rashid Al-Habsi', '1983-07-30', 'M', 'Technical', '2400', '28800', '86400']
  ];

  return rows.map(r => r.join(',')).join('\n');
}
