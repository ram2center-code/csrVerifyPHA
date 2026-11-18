import React, { useState, useRef, type ChangeEvent } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  CircularProgress,
  Stack,
  alpha,
  TextField,
  InputAdornment,
  LinearProgress,
} from '@mui/material';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import MedicationRoundedIcon from '@mui/icons-material/MedicationRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import NetworkCheckRoundedIcon from '@mui/icons-material/NetworkCheckRounded';

import type { MasterItem } from '../types';
import { parseExcelFile, exportTemplateExcel } from '../utils/excelParser';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import {
  bulkUploadToSupabase,
  testSupabaseConnection,
  clearSupabaseMasterTable,
} from '../lib/supabaseService';

interface MasterDataViewProps {
  masterItems: MasterItem[];
  onRefreshFromSupabase: () => void;
  isLoading: boolean;
}

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  masterItems,
  onRefreshFromSupabase,
  isLoading,
}) => {
  const [uploadingToSupabase, setUploadingToSupabase] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [cloudProgress, setCloudProgress] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cloudSuccessMsg, setCloudSuccessMsg] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    connected: boolean;
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ปุ่มกดทดสอบการเชื่อมต่อ Database
  const handleTestConnection = async () => {
    setTestingConn(true);
    setErrorMsg(null);
    setCloudSuccessMsg(null);
    setConnectionStatus(null);

    try {
      const res = await testSupabaseConnection();
      setConnectionStatus({
        tested: true,
        connected: res.connected,
        message: res.message,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setConnectionStatus({
        tested: true,
        connected: false,
        message: `เกิดข้อผิดพลาด: ${msg}`,
      });
    } finally {
      setTestingConn(false);
    }
  };

  // เมื่อเลือกไฟล์ Excel -> อ่านไฟล์และส่งตรงขึ้น Supabase Database ทันที (Direct Import to Cloud)
  const handleDirectImportToSupabase = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSupabaseConfigured) {
      setErrorMsg('ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ในไฟล์ .env ไม่สามารถนำเข้าข้อมูลขึ้น Supabase ได้');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingToSupabase(true);
    setErrorMsg(null);
    setCloudSuccessMsg(null);
    setCloudProgress(0);

    try {
      // 1. อ่านไฟล์ Excel
      const parsedItems = await parseExcelFile(file);
      if (parsedItems.length === 0) {
        throw new Error('ไม่พบข้อมูลรายการยาในไฟล์ Excel หรือตารางว่างเปล่า');
      }

      // 2. ส่งตรงขึ้น Supabase Database
      const { successCount, errors } = await bulkUploadToSupabase(parsedItems, (percent) => {
        setCloudProgress(percent);
      });

      if (errors.length > 0) {
        setErrorMsg(`อัปโหลดขึ้น Supabase สำเร็จ ${successCount} รายการ แต่มีข้อผิดพลาดบางส่วน: ${errors.join(', ')}`);
      } else {
        setCloudSuccessMsg(`นำเข้าไฟล์ "${file.name}" ตรงขึ้นฐานข้อมูล Supabase สำเร็จทั้งหมด ${successCount} รายการ!`);
      }

      // 3. รีเฟรชดึงข้อมูลล่าสุดจาก Supabase
      onRefreshFromSupabase();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`เกิดข้อผิดพลาดในการนำเข้าขึ้น Supabase: ${msg}`);
    } finally {
      setUploadingToSupabase(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // ลบข้อมูลบน Supabase
  const handleClearCloudData = async () => {
    if (!isSupabaseConfigured) {
      setErrorMsg('ยังไม่ได้ตั้งค่า Supabase ในไฟล์ .env');
      return;
    }

    if (!window.confirm('คำเตือน: คุณต้องการลบข้อมูลยาในตาราง medicine_master บน Supabase ทั้งหมดหรือไม่?')) {
      return;
    }

    setErrorMsg(null);
    setCloudSuccessMsg(null);
    try {
      await clearSupabaseMasterTable();
      setCloudSuccessMsg('ลบข้อมูลบนฐานข้อมูล Supabase เรียบร้อยแล้ว');
      onRefreshFromSupabase();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    }
  };

  const filteredItems = masterItems.filter((item) => {
    const q = searchFilter.toLowerCase();
    return (
      item.barcode.toLowerCase().includes(q) ||
      item.itemCode.toLowerCase().includes(q) ||
      item.itemName.toLowerCase().includes(q) ||
      (item.medicineType && item.medicineType.toLowerCase().includes(q)) ||
      (item.unitName && item.unitName.toLowerCase().includes(q))
    );
  });

  return (
    <Box>
      {/* Header & Action Controls */}
      <Card
        elevation={0}
        sx={{
          borderRadius: 4,
          mb: 3,
          border: '1px solid rgba(226, 232, 240, 0.8)',
          background: 'linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)',
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Stack
            sx={{
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              gap: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 52,
                  height: 52,
                  borderRadius: 3,
                  bgcolor: alpha('#0284c7', 0.1),
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MedicationRoundedIcon sx={{ fontSize: 32 }} />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    Supabase Cloud Master Data
                  </Typography>
                  <Chip
                    label={isSupabaseConfigured ? 'Supabase Database Mode' : 'No .env Configuration'}
                    color={isSupabaseConfigured ? 'success' : 'default'}
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  อัปโหลดไฟล์ Excel เข้า Supabase Database โดยตรง (ไม่เก็บใน Local) เพื่อให้อุปกรณ์ iPad สแกนดึงข้อมูลจาก Cloud
                </Typography>
              </Box>
            </Box>

            {/* Action Buttons */}
            <Stack sx={{ flexDirection: 'row', gap: 1.5, flexWrap: 'wrap' }}>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleDirectImportToSupabase}
              />

              {/* ปุ่มทดสอบการเชื่อมต่อ Database */}
              <Button
                variant="outlined"
                color="info"
                startIcon={testingConn ? <CircularProgress size={18} color="inherit" /> : <NetworkCheckRoundedIcon />}
                onClick={handleTestConnection}
                disabled={testingConn || uploadingToSupabase}
                sx={{
                  borderRadius: 2.5,
                  fontWeight: 700,
                  bgcolor: alpha('#0284c7', 0.04),
                }}
              >
                {testingConn ? 'กำลังทดสอบ...' : 'ทดสอบต่อ Database'}
              </Button>

              <Button
                variant="outlined"
                startIcon={<DownloadRoundedIcon />}
                onClick={exportTemplateExcel}
                sx={{ borderRadius: 2.5 }}
              >
                โหลด Template
              </Button>

              {/* Import Excel ตรงเข้า Supabase ทันที */}
              <Button
                variant="contained"
                color="primary"
                startIcon={uploadingToSupabase ? <CircularProgress size={18} color="inherit" /> : <CloudUploadRoundedIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingToSupabase || isLoading}
                sx={{
                  borderRadius: 2.5,
                  px: 2.5,
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
                }}
              >
                {uploadingToSupabase ? `กำลัง Upload (${cloudProgress}%)` : 'Import Excel เข้า Supabase'}
              </Button>

              {/* ปุ่ม Refresh จาก Supabase */}
              <Button
                variant="outlined"
                startIcon={isLoading ? <CircularProgress size={16} /> : <RefreshRoundedIcon />}
                onClick={onRefreshFromSupabase}
                disabled={isLoading || uploadingToSupabase}
                sx={{ borderRadius: 2.5 }}
              >
                รีเฟรชข้อมูล
              </Button>

              {masterItems.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteSweepRoundedIcon />}
                  onClick={handleClearCloudData}
                  disabled={uploadingToSupabase || isLoading}
                  sx={{ borderRadius: 2.5 }}
                >
                  ลบข้อมูลใน Supabase
                </Button>
              )}
            </Stack>
          </Stack>

          {/* Cloud Sync Progress Bar */}
          {uploadingToSupabase && (
            <Box sx={{ width: '100%', mt: 2 }}>
              <LinearProgress variant="determinate" value={cloudProgress} sx={{ height: 8, borderRadius: 4 }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, textAlign: 'center' }}>
                กำลังส่งข้อมูล Excel ตรงขึ้นฐานข้อมูล Supabase... ({cloudProgress}%)
              </Typography>
            </Box>
          )}

          {/* Connection Test Status Alert */}
          {connectionStatus && (
            <Alert
              severity={connectionStatus.connected ? 'success' : 'error'}
              sx={{ mt: 2.5, borderRadius: 3, fontWeight: 600 }}
              icon={connectionStatus.connected ? <CheckCircleOutlineRoundedIcon /> : undefined}
            >
              {connectionStatus.message}
            </Alert>
          )}

          {/* Feedback Alerts */}
          {errorMsg && (
            <Alert severity="error" sx={{ mt: 2.5, borderRadius: 3 }}>
              {errorMsg}
            </Alert>
          )}

          {cloudSuccessMsg && (
            <Alert
              icon={<CheckCircleOutlineRoundedIcon />}
              severity="success"
              sx={{ mt: 2.5, borderRadius: 3 }}
            >
              {cloudSuccessMsg}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Database Stats & Search Filter */}
      <Card
        elevation={0}
        sx={{
          borderRadius: 4,
          border: '1px solid rgba(226, 232, 240, 0.8)',
          bgcolor: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            p: 2.5,
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              รายการข้อมูลยาในฐานข้อมูล Supabase
            </Typography>
            <Chip
              label={`${masterItems.length} รายการบน Cloud`}
              size="small"
              color="primary"
              sx={{ fontWeight: 700 }}
            />
          </Box>

          <TextField
            size="small"
            placeholder="ค้นหาด้วย BARCODE, Code, ชื่อยา Name หรือชนิดยา..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            sx={{ width: { xs: '100%', sm: 380 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRoundedIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                sx: { borderRadius: 2.5, bgcolor: '#f8fafc' },
              },
            }}
          />
        </Box>

        {/* Master Items Table */}
        <TableContainer sx={{ maxHeight: 520 }}>
          <Table stickyHeader>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>MEDICINE TYPE (ชนิดยา)</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>BARCODE (รหัสสแกน)</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Code (รหัสยา)</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Name (ชื่อยา / สินค้า)</TableCell>
                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Unit Name (หน่วย)</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>สถานะ Cloud</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={30} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      กำลังดึงข้อมูลจาก Supabase Database...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography variant="body1" color="text.secondary">
                      {masterItems.length === 0
                        ? 'ยังไม่มีข้อมูลใน Supabase — กรุณากด "Import Excel เข้า Supabase" เพื่อนำเข้าไฟล์ยา'
                        : 'ไม่พบรายการที่ตรงกับคำค้นหา'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Chip
                        label={row.medicineType || 'ทั่วไป'}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          bgcolor: alpha('#0284c7', 0.1),
                          color: '#0284c7',
                          borderRadius: 2,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, color: 'primary.main', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                      {row.barcode}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>
                      {row.itemCode}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>
                      {row.itemName}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.unitName || '-'}
                        size="small"
                        variant="outlined"
                        sx={{ borderColor: '#cbd5e1', fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label="SUPABASE"
                        size="small"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          bgcolor: alpha('#10b981', 0.12),
                          color: '#059669',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
};
