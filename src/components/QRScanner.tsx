import { useEffect, useRef, useState, type FC } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Stack,
  alpha,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import { Html5Qrcode } from 'html5-qrcode';

interface ScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

export const QRScanner: FC<ScannerProps> = ({ onScanSuccess }) => {
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'reader-container';

  const startScanner = async () => {
    setErrorMsg(null);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerId);
      }
      setScanning(true);
      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 260, height: 260 },
        },
        (decodedText) => {
          onScanSuccess(decodedText);
        },
        () => {
          // Silent frame tracking
        }
      );
    } catch (err: unknown) {
      setScanning(false);
      const message = err instanceof Error ? err.message : String(err);
      setErrorMsg(`ไม่สามารถเข้าถึงกล้องได้: ${message}`);
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
    <Card
      elevation={0}
      sx={{
        borderRadius: 4,
        mb: 3,
        border: '1px solid rgba(226, 232, 240, 0.8)',
        background: 'linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)',
        overflow: 'hidden',
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Stack
          sx={{
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
            mb: scanning ? 2.5 : 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 3,
                bgcolor: alpha('#0284c7', 0.1),
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CenterFocusStrongIcon sx={{ fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Scan Barcode / QR Code
              </Typography>
              <Typography variant="caption" color="text.secondary">
                สแกนฉลากปลอดเชื้อ รหัสเซ็ตเครื่องมือ หรือถุง Sterilization Pouch
              </Typography>
            </Box>
          </Box>

          {!scanning ? (
            <Button
              variant="contained"
              startIcon={<QrCodeScannerIcon />}
              onClick={startScanner}
              sx={{
                px: 2.5,
                py: 1,
                borderRadius: 2.5,
                fontSize: '0.9rem',
              }}
            >
              เปิดกล้องสแกน
            </Button>
          ) : (
            <Button
              variant="outlined"
              startIcon={<StopCircleIcon />}
              onClick={stopScanner}
              color="error"
              sx={{
                px: 2.5,
                py: 1,
                borderRadius: 2.5,
                borderWidth: 1.5,
                fontWeight: 600,
              }}
            >
              หยุดกล้อง
            </Button>
          )}
        </Stack>

        {errorMsg && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 3 }}>
            {errorMsg}
          </Alert>
        )}

        {/* Camera Container with Modern Viewport Outline */}
        <Box
          sx={{
            display: scanning ? 'block' : 'none',
            position: 'relative',
            width: '100%',
            maxWidth: 520,
            mx: 'auto',
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(15, 23, 42, 0.12)',
            border: '2px solid #0284c7',
          }}
        >
          <Box
            id={containerId}
            sx={{
              width: '100%',
              minHeight: 320,
              bgcolor: '#0f172a',
            }}
          />
        </Box>

        {scanning && (
          <Stack
            sx={{
              flexDirection: 'row',
              gap: 1.5,
              justifyContent: 'center',
              alignItems: 'center',
              mt: 2,
            }}
          >
            <CircularProgress size={18} thickness={5} sx={{ color: 'primary.main' }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              กำลังส่องหาบาร์โค้ด / QR Code...
            </Typography>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};
