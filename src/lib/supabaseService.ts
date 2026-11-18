import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { MasterItem } from '../types';

export const TABLE_NAME = 'medicine_master';

/**
 * ทดสอบการเชื่อมต่อ Database Supabase และตรวจสอบตาราง medicine_master
 */
export const testSupabaseConnection = async (): Promise<{
  connected: boolean;
  message: string;
  rowCount?: number;
  latencyMs?: number;
}> => {
  if (!isSupabaseConfigured) {
    return {
      connected: false,
      message: 'ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ในไฟล์ .env (หรือค่ายังเป็นค่าว่าง)',
    };
  }

  const startTime = performance.now();

  try {
    const { count, error } = await supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true });

    const latencyMs = Math.round(performance.now() - startTime);

    if (error) {
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        return {
          connected: false,
          latencyMs,
          message: `เชื่อมต่อ Supabase ได้แล้ว แต่ไม่พบตาราง "${TABLE_NAME}" — กรุณารันคำสั่งใน supabase_schema.sql ใน Supabase SQL Editor`,
        };
      }
      return {
        connected: false,
        latencyMs,
        message: `เชื่อมต่อไม่สำเร็จ: ${error.message} (Code: ${error.code})`,
      };
    }

    return {
      connected: true,
      latencyMs,
      rowCount: count ?? 0,
      message: `เชื่อมต่อ Supabase สำเร็จ! (พบข้อมูลในตาราง ${count ?? 0} รายการ, ความเร็วตอบสนอง ${latencyMs} ms)`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      message: `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${msg}`,
    };
  }
};

/**
 * ค้นหาข้อมูลยาจาก Supabase ด้วย Barcode หรือ Item Code แบบ Real-time
 */
export const queryBarcodeFromSupabase = async (code: string): Promise<MasterItem | null> => {
  if (!isSupabaseConfigured) return null;

  const clean = code.trim();
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .or(`barcode.eq.${clean},item_code.eq.${clean}`)
    .limit(1);

  if (error || !data || data.length === 0) {
    return null;
  }

  const row = data[0];
  return {
    id: String(row.id),
    medicineType: row.medicine_type || '',
    barcode: row.barcode || '',
    itemCode: row.item_code || '',
    itemName: row.item_name || '',
    unitName: row.unit_name || '',
    imageUrl: row.image_url || '',
    department: row.department || '',
    status: row.status || 'available',
    importedAt: row.created_at || '',
    rawExtra: row,
  };
};

/**
 * ดึงข้อมูล Master Data ยาทั้งหมดจาก Supabase
 */
export const fetchMasterItemsFromSupabase = async (): Promise<MasterItem[]> => {
  if (!isSupabaseConfigured) {
    throw new Error('ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ในไฟล์ .env');
  }

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`เกิดข้อผิดพลาดในการดึงข้อมูลจาก Supabase: ${error.message}`);
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: String(row.id),
    medicineType: row.medicine_type || '',
    barcode: row.barcode || '',
    itemCode: row.item_code || '',
    itemName: row.item_name || '',
    unitName: row.unit_name || '',
    imageUrl: row.image_url || '',
    department: row.department || '',
    status: row.status || 'available',
    importedAt: row.created_at || '',
    rawExtra: row,
  }));
};

/**
 * ลบข้อมูลทั้งหมดในตาราง medicine_master บน Supabase
 */
export const clearSupabaseMasterTable = async (): Promise<void> => {
  if (!isSupabaseConfigured) {
    throw new Error('ยังไม่ได้ตั้งค่า Supabase ในไฟล์ .env');
  }

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .neq('id', 0);

  if (error) {
    throw new Error(`ลบข้อมูลบน Supabase ไม่สำเร็จ: ${error.message}`);
  }
};

/**
 * Bulk Upsert ข้อมูลจาก Excel เข้า Supabase โดยตรง (Direct Upload)
 * พร้อมระบบ Deduplicate กำจัดบาร์โค้ดที่ซ้ำกันในไฟล์ Excel ก่อนส่งเข้าฐานข้อมูล
 */
export const bulkUploadToSupabase = async (
  items: MasterItem[],
  onProgress?: (progressPercent: number) => void
): Promise<{ successCount: number; errors: string[] }> => {
  if (!isSupabaseConfigured) {
    throw new Error('กรุณาระบุ URL และ Anon Key ในไฟล์ .env ก่อนทำการ Upload ขึ้น Supabase');
  }

  // 1. กรองตัดแถวที่บาร์โค้ดว่าง และ Deduplicate บาร์โค้ดที่ซ้ำกันภายในไฟล์ Excel เอง
  // ใช้ Map โดยยึดตัวล่าสุด (หรือตัวแรก) เพื่อไม่ให้เกิด ON CONFLICT DO UPDATE ซ้ำสองรอบใน Batch เดียว
  const uniqueBarcodeMap = new Map<string, any>();

  for (const item of items) {
    const rawBarcode = String(item.barcode || '').trim();
    if (!rawBarcode) continue; // ข้ามแถวที่ไม่มีบาร์โค้ด

    // บันทึก/ทับค่าด้วยแถวล่าสุดของบาร์โค้ดนั้น
    uniqueBarcodeMap.set(rawBarcode, {
      barcode: rawBarcode,
      item_code: String(item.itemCode || rawBarcode).trim(),
      item_name: String(item.itemName || 'ไม่ระบุชื่อ').trim(),
      medicine_type: String(item.medicineType || '').trim(),
      unit_name: String(item.unitName || '').trim(),
      image_url: String(item.imageUrl || '').trim(),
      status: item.status || 'available',
    });
  }

  const uniqueRecords = Array.from(uniqueBarcodeMap.values());

  if (uniqueRecords.length === 0) {
    throw new Error('ไม่พบบาร์โค้ดที่ถูกต้องในไฟล์ Excel (บาร์โค้ดว่างทั้งหมด)');
  }

  const BATCH_SIZE = 100; // ปรับเป็น Batch ละ 100 เพื่อความเสถียรสูงสุด
  let successCount = 0;
  const errors: string[] = [];

  for (let i = 0; i < uniqueRecords.length; i += BATCH_SIZE) {
    const chunk = uniqueRecords.slice(i, i + BATCH_SIZE);

    // Upsert ลงตาราง medicine_master โดยใช้ barcode เป็น Unique conflict
    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert(chunk, { onConflict: 'barcode' });

    if (error) {
      errors.push(`ชุดที่ ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
    } else {
      successCount += chunk.length;
    }

    if (onProgress) {
      const percent = Math.min(100, Math.round(((i + chunk.length) / uniqueRecords.length) * 100));
      onProgress(percent);
    }
  }

  return { successCount, errors };
};

/**
 * บันทึกประวัติการสแกนขึ้น Supabase (Audit Logs)
 */
export const saveScanLogToSupabase = async (
  scannedCode: string,
  matchedItem?: MasterItem,
  verifiedBy: string = 'iPad Station'
) => {
  if (!isSupabaseConfigured) return;

  try {
    await supabase.from('scan_audit_logs').insert([
      {
        scanned_code: scannedCode,
        is_matched: Boolean(matchedItem),
        item_code: matchedItem?.itemCode || null,
        item_name: matchedItem?.itemName || null,
        medicine_type: matchedItem?.medicineType || null,
        verified_by: verifiedBy,
      },
    ]);
  } catch (err) {
    console.error('Failed to log scan to Supabase:', err);
  }
};
