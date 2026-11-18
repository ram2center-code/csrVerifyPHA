import { useState, useRef, useEffect, type FC } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  Stack,
  alpha,
  TextField,
  InputAdornment,
  Paper,
  Divider,
  Chip,
  CircularProgress,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded';
import FlashOnRoundedIcon from '@mui/icons-material/FlashOnRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import MedicationRoundedIcon from '@mui/icons-material/MedicationRounded';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

import type { MasterItem, ScanVerificationResult } from '../types';
import { queryBarcodeFromSupabase, saveScanLogToSupabase } from '../lib/supabaseService';
import { isSupabaseConfigured } from '../lib/supabaseClient';

interface IPadScannerProps {
  masterItems: MasterItem[];
  onScanResult: (result: ScanVerificationResult) => void;
}

export const IPadScanner: FC<IPadScannerProps> = ({ masterItems, onScanResult }) => {
  const [scanning, setScanning] = useState(false);
  const [searchingCloud, setSearchingCloud] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ScanVerificationResult | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'ipad-scanner-viewport';
  const lastScannedTimeRef = useRef<number>(0);

  // Audio feedback helper for iPad/Web
  const playBeep = (type: 'success' | 'error') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // High pleasant beep
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(300, audioCtx.currentTime); // Low warning/error beep
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch {
      // Audio might be muted
    }
  };

  // Matching algorithm: Search in Supabase Cloud
  const verifyScannedBarcode = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;

    // Prevent duplicate scans within 1.5 seconds
    const now = Date.now();
    if (now - lastScannedTimeRef.current < 1500) {
      return;
    }
    lastScannedTimeRef.current = now;

    setSearchingCloud(true);
    let foundItem: MasterItem | null = null;

    try {
      // 1. ค้นหาจาก Supabase Database โดยตรงแบบ Real-time
      if (isSupabaseConfigured) {
        foundItem = await queryBarcodeFromSupabase(cleanCode);
      }

      // 2. ถ้าใน Supabase ไม่เจอ ให้ค้นจาก State Cache ที่โหลดไว้
      if (!foundItem && masterItems.length > 0) {
        foundItem = masterItems.find(
          (item) =>
            item.barcode.toLowerCase() === cleanCode.toLowerCase() ||
            item.itemCode.toLowerCase() === cleanCode.toLowerCase()
        ) || null;
      }

      let result: ScanVerificationResult;

      if (!foundItem) {
        playBeep('error');
        result = {
          scanTimestamp: new Date().toLocaleTimeString(),
          scannedCode: cleanCode,
          found: false,
          verificationStatus: 'NOT_FOUND',
          message: `ไม่พบข้อมูลบาร์โค้ด "${cleanCode}" ในฐานข้อมูล Supabase`,
        };
      } else {
        playBeep('success');
        result = {
          scanTimestamp: new Date().toLocaleTimeString(),
          scannedCode: cleanCode,
          found: true,
          item: foundItem,
          verificationStatus: 'VALID',
          message: `พบข้อมูล: [${foundItem.itemCode}] ${foundItem.itemName} (${foundItem.medicineType || 'ยา'})`,
        };

        // บันทึก Log การสแกนขึ้น Supabase Background
        saveScanLogToSupabase(cleanCode, foundItem);
      }

      setLastResult(result);
      onScanResult(result);
      setManualCode('');
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setSearchingCloud(false);
    }
  };

  const startScanner = async () => {
    setErrorMsg(null);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
          ],
          verbose: false,
        });
      }
      setScanning(true);
      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 20,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.floor(minEdge * 0.9),
              height: Math.floor(minEdge * 0.5),
            };
          },
        },
        (decodedText) => {
          verifyScannedBarcode(decodedText);
        },
        () => {
          // Tracking frame
        }
      );
    } catch (err: unknown) {
      setScanning(false);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(`ไม่สามารถเปิดกล้องได้: ${message} (กรุณากด Allow กล้องบน iPad)`);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      } finally {
        setScanning(false);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current && scanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [scanning]);

  return (
    <Box>
      <Card
        elevation={0}
        sx={{
          borderRadius: 4,
          mb: 3,
          border: '1px solid rgba(226, 232, 240, 0.8)',
          background: 'linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)',
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
          {/* Header */}
          <Stack
            sx={{
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 2,
              mb: 2.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 3,
                  bgcolor: alpha('#0284c7', 0.1),
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CenterFocusStrongIcon sx={{ fontSize: 28 }} />
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    iPad Barcode Scanner (Direct Supabase)
                  </Typography>
                  <Chip
                    icon={<CloudDoneRoundedIcon />}
                    label="Supabase Query"
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 700 }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  ยิงสแกน Barcode ➔ วิ่งไปค้นหาข้อมูลยาในฐานข้อมูล Supabase Cloud โดยตรง
                </Typography>
              </Box>
            </Box>

            {/* Action buttons */}
            <Stack sx={{ flexDirection: 'row', gap: 1.5 }}>
              <Button
                variant={soundEnabled ? 'outlined' : 'text'}
                size="small"
                startIcon={<VolumeUpRoundedIcon />}
                onClick={() => setSoundEnabled(!soundEnabled)}
                sx={{ borderRadius: 2 }}
              >
                {soundEnabled ? 'เสียงเปิด' : 'เสียงปิด'}
              </Button>

              {!scanning ? (
                <Button
                  variant="contained"
                  startIcon={<CameraAltRoundedIcon />}
                  onClick={startScanner}
                  sx={{
                    px: 3,
                    py: 1,
                    borderRadius: 2.5,
                    fontSize: '0.95rem',
                  }}
                >
                  เปิดกล้อง iPad สแกน
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<StopCircleIcon />}
                  onClick={stopScanner}
                  color="error"
                  sx={{
                    px: 3,
                    py: 1,
                    borderRadius: 2.5,
                    borderWidth: 2,
                    fontWeight: 700,
                  }}
                >
                  ปิดกล้อง
                </Button>
              )}
            </Stack>
          </Stack>

          {errorMsg && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: 3 }}>
              {errorMsg}
            </Alert>
          )}

          {/* iPad Camera Viewport with Barcode Box */}
          <Box
            sx={{
              display: scanning ? 'block' : 'none',
              position: 'relative',
              width: '100%',
              maxWidth: 640,
              mx: 'auto',
              borderRadius: 4,
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(15, 23, 42, 0.16)',
              border: '3px solid #0284c7',
              bgcolor: '#0f172a',
              mb: 3,
            }}
          >
            <Box
              id={containerId}
              sx={{
                width: '100%',
                minHeight: 360,
              }}
            />
            {scanning && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bgcolor: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(8px)',
                  px: 2,
                  py: 0.5,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <FlashOnRoundedIcon sx={{ fontSize: 16, color: '#38bdf8' }} />
                <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>
                  เล็งแถบบาร์โค้ดสินค้าให้อยู่ในกรอบ
                </Typography>
              </Box>
            )}
          </Box>

          {/* Manual / Bluetooth Scanner Input */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              bgcolor: '#f8fafc',
              border: '1px solid #e2e8f0',
              mb: 3,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#334155' }}>
              หรือ ยิงด้วยเครื่องยิง Barcode Bluetooth / พิมพ์รหัสเพื่อค้นหาใน Supabase
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField
                fullWidth
                size="small"
                placeholder="สแกนบาร์โค้ด หรือพิมพ์รหัส เช่น 8852629000372 หรือ AA00000291 แล้วกด Enter"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') verifyScannedBarcode(manualCode);
                }}
                disabled={searchingCloud}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <QrCodeScannerIcon sx={{ color: 'primary.main' }} />
                      </InputAdornment>
                    ),
                    sx: { bgcolor: '#ffffff', borderRadius: 2 },
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={() => verifyScannedBarcode(manualCode)}
                disabled={searchingCloud}
                startIcon={searchingCloud ? <CircularProgress size={16} color="inherit" /> : null}
                sx={{ px: 3.5, borderRadius: 2, minWidth: 140 }}
              >
                {searchingCloud ? 'กำลังค้นหา...' : 'ค้นหาใน Cloud'}
              </Button>
            </Box>
          </Paper>

          {/* Real-time Large Inspection Display for iPad */}
          {lastResult && (
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, sm: 3.5 },
                borderRadius: 4,
                border: '2px solid',
                borderColor: lastResult.found ? '#10b981' : '#94a3b8',
                background: lastResult.found
                  ? 'linear-gradient(135deg, #ffffff 0%, #ecfdf5 100%)'
                  : 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
              }}
            >
              <Stack
                sx={{
                  flexDirection: { xs: 'column', sm: 'row' },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'flex-start', sm: 'center' },
                  gap: 2,
                  mb: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {lastResult.found ? (
                    <CheckCircleRoundedIcon sx={{ fontSize: 48, color: '#10b981' }} />
                  ) : (
                    <HelpOutlineRoundedIcon sx={{ fontSize: 48, color: '#64748b' }} />
                  )}
                  <Box>
                    <Typography
                      variant="h5"
                      sx={{
                        fontWeight: 800,
                        color: lastResult.found ? '#065f46' : '#334155',
                      }}
                    >
                      {lastResult.found ? 'MATCHED — พบข้อมูลในฐานข้อมูล Supabase' : 'NOT FOUND — ไม่พบข้อมูลสินค้านี้ใน Supabase'}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>
                      รหัสที่สแกน: <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{lastResult.scannedCode}</span> | เวลา: {lastResult.scanTimestamp}
                    </Typography>
                  </Box>
                </Box>

                {lastResult.found && lastResult.item?.medicineType && (
                  <Chip
                    icon={<MedicationRoundedIcon />}
                    label={lastResult.item.medicineType}
                    color="primary"
                    sx={{ fontWeight: 700, fontSize: '0.9rem', py: 2, px: 1, borderRadius: 3 }}
                  />
                )}
              </Stack>

              <Divider sx={{ my: 2 }} />

              {/* Matched Medicine Details */}
              {lastResult.item ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      md: '2fr 1fr 1fr 1fr',
                    },
                    gap: 1.5,
                    mt: 2,
                  }}
                >
                  <Paper sx={{ p: 2, borderRadius: 2.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" color="text.secondary">
                      Name (ชื่อยา / สินค้า)
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                      {lastResult.item.itemName}
                    </Typography>
                  </Paper>

                  <Paper sx={{ p: 2, borderRadius: 2.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" color="text.secondary">
                      Code (รหัสยา)
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'primary.main', fontFamily: 'monospace' }}>
                      {lastResult.item.itemCode}
                    </Typography>
                  </Paper>

                  <Paper sx={{ p: 2, borderRadius: 2.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" color="text.secondary">
                      BARCODE (บาร์โค้ดสินค้า)
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>
                      {lastResult.item.barcode}
                    </Typography>
                  </Paper>

                  <Paper sx={{ p: 2, borderRadius: 2.5, bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
                    <Typography variant="caption" color="text.secondary">
                      Unit Name (หน่วยนับ)
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#059669' }}>
                      {lastResult.item.unitName || 'TAB'}
                    </Typography>
                  </Paper>
                </Box>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  รหัสนี้ยังไม่ได้ถูกบันทึกในตาราง Supabase กรุณา Import ไฟล์ Excel ในแท็บ "Bulk Master Data"
                </Typography>
              )}
            </Paper>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
