export interface MasterItem {
  id: string;
  barcode: string;           // รหัสบาร์โค้ดหลักที่ใช้ยิงสแกน (Key สำหรับค้นหา เช่น 8852629000372)
  itemCode: string;          // รหัสยา / รหัสสินค้า (Code เช่น AA00000291)
  itemName: string;          // ชื่อยา / สินค้า (Name เช่น ABILIFY 2 mg TABLET...)
  medicineType?: string;     // ชนิดยา / ประเภทยา (MEDICINE TYPE เช่น ยาเม็ด)
  unitName?: string;         // หน่วยนับ (Unit Name เช่น TAB, BOT, VIAL)
  imageUrl?: string;         // รูปภาพ (ถ้ามี)
  department?: string;       // แผนก / คลังยา
  sterilizationDate?: string;// วันที่ผลิต / ผลิตภัณฑ์
  expiryDate?: string;       // วันหมดอายุ
  lotNumber?: string;        // หมายเลข Lot
  location?: string;         // สถานที่จัดเก็บ / ชั้นวาง
  status?: 'sterile' | 'expired' | 'recalled' | 'available' | 'in_use';
  importedAt?: string;       // เวลาที่ import เข้ามา
  rawExtra?: Record<string, any>; // ข้อมูลคอลัมน์อื่นๆ ใน Excel ทั้งหมด
}

export interface ScanVerificationResult {
  scanTimestamp: string;
  scannedCode: string;
  found: boolean;
  item?: MasterItem;
  verificationStatus: 'VALID' | 'EXPIRED' | 'NOT_FOUND' | 'RECALLED' | 'WARNING';
  message: string;
  verifiedBy?: string;
}

export interface VerificationItem {
  id: string;
  itemCode: string;
  itemName: string;
  department: string;
  sterilizationDate: string;
  expiryDate: string;
  lotNumber: string;
  status: 'sterile' | 'expired' | 'recalled' | 'unverified';
  verifiedAt?: string;
  verifiedBy?: string;
}
