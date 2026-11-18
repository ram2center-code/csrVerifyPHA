import * as XLSX from 'xlsx';
import type { MasterItem } from '../types';

export const parseExcelFile = async (file: File): Promise<MasterItem[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!jsonRows || jsonRows.length === 0) {
          resolve([]);
          return;
        }

        const items: MasterItem[] = jsonRows.map((row, index) => {
          // Normalize column keys to lowercase and trim spaces for robust matching
          const lowerKeyMap: Record<string, any> = {};
          Object.keys(row).forEach((k) => {
            const cleanKey = k.trim().toLowerCase().replace(/\s+/g, '');
            lowerKeyMap[cleanKey] = row[k];
          });

          // 1. Medicine Type / ชนิดยา
          const medicineType = String(
            lowerKeyMap['medicinetype'] ||
            lowerKeyMap['medicine_type'] ||
            lowerKeyMap['ชนิดยา'] ||
            lowerKeyMap['ประเภทยา'] ||
            lowerKeyMap['type'] ||
            ''
          ).trim();

          // 2. Barcode (รองรับ: BARCODE สินค้าผู้ต้อง, BARCODE, บาร์โค้ด)
          const barcode = String(
            lowerKeyMap['barcodeสินค้าผู้ต้อง'] ||
            lowerKeyMap['barcodeสินค้าผู้ต้องฯ'] ||
            lowerKeyMap['barcodeผู้ต้อง'] ||
            lowerKeyMap['barcode'] ||
            lowerKeyMap['bar_code'] ||
            lowerKeyMap['qr'] ||
            lowerKeyMap['qrcode'] ||
            lowerKeyMap['รหัสบาร์โค้ด'] ||
            lowerKeyMap['บาร์โค้ด'] ||
            lowerKeyMap['code'] ||
            `BC-${index + 1}`
          ).trim();

          // 3. Item Code / รหัสสินค้า (Code)
          const itemCode = String(
            lowerKeyMap['code'] ||
            lowerKeyMap['itemcode'] ||
            lowerKeyMap['item_code'] ||
            lowerKeyMap['รหัส'] ||
            lowerKeyMap['รหัสยา'] ||
            lowerKeyMap['รหัสสินค้า'] ||
            barcode
          ).trim();

          // 4. Name / ชื่อยา (Name)
          const itemName = String(
            lowerKeyMap['name'] ||
            lowerKeyMap['itemname'] ||
            lowerKeyMap['item_name'] ||
            lowerKeyMap['ชื่อยา'] ||
            lowerKeyMap['ชื่อ'] ||
            lowerKeyMap['ชื่อสินค้า'] ||
            lowerKeyMap['รายการ'] ||
            'ไม่ระบุชื่อ'
          ).trim();

          // 5. Unit Name / หน่วยนับ (Unit Name)
          const unitName = String(
            lowerKeyMap['unitname'] ||
            lowerKeyMap['unit_name'] ||
            lowerKeyMap['unit'] ||
            lowerKeyMap['หน่วย'] ||
            lowerKeyMap['หน่วยนับ'] ||
            ''
          ).trim();

          // 6. Image / รูปภาพ
          const imageUrl = String(
            lowerKeyMap['รูปภาพ'] ||
            lowerKeyMap['image'] ||
            lowerKeyMap['imageurl'] ||
            lowerKeyMap['photo'] ||
            ''
          ).trim();

          // 7. Department / คลัง / แผนก
          const department = String(
            lowerKeyMap['department'] ||
            lowerKeyMap['dept'] ||
            lowerKeyMap['ward'] ||
            lowerKeyMap['แผนก'] ||
            lowerKeyMap['คลัง'] ||
            lowerKeyMap['คลังยา'] ||
            medicineType ||
            'Pharmacy / คลังยา'
          ).trim();

          // 8. Sterilization / MFG Date
          const sterilizationDate = String(
            lowerKeyMap['sterilizationdate'] ||
            lowerKeyMap['sterile_date'] ||
            lowerKeyMap['mfgdate'] ||
            lowerKeyMap['วันที่ผลิต'] ||
            lowerKeyMap['วันฆ่าเชื้อ'] ||
            ''
          ).trim();

          // 9. Expiry Date (EXP)
          const expiryDate = String(
            lowerKeyMap['expirydate'] ||
            lowerKeyMap['exp_date'] ||
            lowerKeyMap['exp'] ||
            lowerKeyMap['expire'] ||
            lowerKeyMap['วันหมดอายุ'] ||
            ''
          ).trim();

          // 10. Lot Number
          const lotNumber = String(
            lowerKeyMap['lotnumber'] ||
            lowerKeyMap['lot'] ||
            lowerKeyMap['lot_no'] ||
            lowerKeyMap['หมายเลขlot'] ||
            ''
          ).trim();

          // 11. Location / Shelf
          const location = String(
            lowerKeyMap['location'] ||
            lowerKeyMap['shelf'] ||
            lowerKeyMap['สถานที่เก็บ'] ||
            lowerKeyMap['ชั้นวาง'] ||
            ''
          ).trim();

          // Status detection
          const rawStatus = String(
            lowerKeyMap['status'] ||
            lowerKeyMap['สถานะ'] ||
            'available'
          ).toLowerCase().trim();

          let status: MasterItem['status'] = 'available';
          if (rawStatus.includes('expire') || rawStatus.includes('หมดอายุ')) {
            status = 'expired';
          } else if (rawStatus.includes('recall') || rawStatus.includes('กัก')) {
            status = 'recalled';
          }

          return {
            id: `item-${Date.now()}-${index}`,
            barcode,
            itemCode,
            itemName,
            medicineType,
            unitName,
            imageUrl,
            department,
            sterilizationDate,
            expiryDate,
            lotNumber,
            location,
            status,
            importedAt: new Date().toISOString(),
            rawExtra: row,
          };
        });

        resolve(items);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};

export const exportTemplateExcel = () => {
  // สร้าง Template ให้ตรงกับรูปแบบไฟล์ของคุณเป๊ะๆ
  const sampleData = [
    {
      'MEDICINE TYPE': 'ยาเม็ด',
      'รูปภาพ': '',
      'BARCODE สินค้าผู้ต้องฯ': '8852629000372',
      'Code': 'AA00000291',
      'Name': 'ABILIFY 2 mg TABLET (ARIPIPRAZOLE)',
      'Unit Name': 'TAB',
    },
    {
      'MEDICINE TYPE': 'ยาเม็ด',
      'รูปภาพ': '',
      'BARCODE สินค้าผู้ต้องฯ': '8852629000389',
      'Code': 'AA00000292',
      'Name': 'ABILIFY 5 mg TABLET (ARIPIPRAZOLE)',
      'Unit Name': 'TAB',
    },
    {
      'MEDICINE TYPE': 'ยาแคปซูล',
      'รูปภาพ': '',
      'BARCODE สินค้าผู้ต้องฯ': '8851000100201',
      'Code': 'AA00000305',
      'Name': 'AMOXICILLIN 500 mg CAPSULE',
      'Unit Name': 'CAP',
    },
    {
      'MEDICINE TYPE': 'ยาน้ำ',
      'รูปภาพ': '',
      'BARCODE สินค้าผู้ต้องฯ': '8851000200302',
      'Code': 'SY00000114',
      'Name': 'PARACETAMOL SYRUP 120 mg/5 ml (60 ml)',
      'Unit Name': 'BOT',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'MedicineMaster');
  XLSX.writeFile(wb, 'Medicine_MasterData_Template.xlsx');
};
