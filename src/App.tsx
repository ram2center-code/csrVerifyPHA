import { useState, useEffect, useCallback } from 'react';
import {
  AppBar,
  Box,
  Container,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  ThemeProvider,
  Avatar,
  Chip,
  Paper,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Snackbar,
  Alert,
  alpha,
  Tooltip,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import TabletMacRoundedIcon from '@mui/icons-material/TabletMacRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import MedicationRoundedIcon from '@mui/icons-material/MedicationRounded';

import { theme } from './theme';
import type { MasterItem, ScanVerificationResult } from './types';
import { IPadScanner } from './components/IPadScanner';
import { MasterDataView } from './components/MasterDataView';
import { fetchMasterItemsFromSupabase } from './lib/supabaseService';
import { isSupabaseConfigured } from './lib/supabaseClient';

const drawerWidth = 260;

type MenuTab = 'scan' | 'master' | 'history';

export default function App() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [currentTab, setCurrentTab] = useState<MenuTab>('scan');

  // Master Data ดึงจาก Supabase เป็นหลัก (ไม่บันทึกลง LocalStorage อีกต่อไป)
  const [masterItems, setMasterItems] = useState<MasterItem[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(false);

  const [scanHistory, setScanHistory] = useState<ScanVerificationResult[]>([]);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'warning' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // ฟังก์ชันดึงข้อมูล Master Data จาก Supabase
  const loadDataFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    setLoadingMaster(true);
    try {
      const items = await fetchMasterItemsFromSupabase();
      setMasterItems(items);
    } catch (err: unknown) {
      console.warn('Could not fetch from Supabase on init:', err);
    } finally {
      setLoadingMaster(false);
    }
  }, []);

  // โหลดข้อมูลจาก Supabase ทันทีเมื่อเปิดเว็บ
  useEffect(() => {
    loadDataFromSupabase();
  }, [loadDataFromSupabase]);

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
    setDesktopOpen((prev) => !prev);
  };

  const handleSelectTab = (tab: MenuTab) => {
    setCurrentTab(tab);
    setMobileOpen(false);
  };

  const handleScanResult = (result: ScanVerificationResult) => {
    setScanHistory((prev) => [result, ...prev]);
    setToast({
      open: true,
      message: result.message,
      severity: result.found ? 'success' : 'warning',
    });
  };

  const handleClearHistory = () => {
    if (window.confirm('คุณต้องการล้างประวัติการสแกนทั้งหมดหรือไม่?')) {
      setScanHistory([]);
      setToast({
        open: true,
        message: 'ล้างประวัติการสแกนเรียบร้อยแล้ว',
        severity: 'info',
      });
    }
  };

  const totalFound = scanHistory.filter((i) => i.found).length;
  const totalNotFound = scanHistory.filter((i) => !i.found).length;

  const navMenuItems = [
    {
      id: 'scan' as MenuTab,
      label: 'iPad Scan Check',
      icon: <TabletMacRoundedIcon />,
      desc: 'สแกน Barcode ค้นหาใน Supabase',
    },
    {
      id: 'master' as MenuTab,
      label: 'Supabase Master Data',
      icon: <StorageRoundedIcon />,
      desc: 'Import Excel ตรงเข้า Supabase',
    },
    {
      id: 'history' as MenuTab,
      label: 'Scan History',
      icon: <HistoryRoundedIcon />,
      desc: 'ประวัติการสแกนตรวจสอบ',
    },
  ];

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2 }}>
      {/* Brand Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1, py: 2, mb: 1.5 }}>
        <Avatar
          sx={{
            width: 44,
            height: 44,
            bgcolor: 'primary.main',
            boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
            background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
          }}
        >
          <MedicationRoundedIcon />
        </Avatar>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            Hospital Verify
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            iPad Barcode Matcher
          </Typography>
        </Box>
      </Box>

      {/* Nav List */}
      <List sx={{ px: 0.5 }}>
        {navMenuItems.map((item) => {
          const isSelected = currentTab === item.id;
          return (
            <ListItemButton
              key={item.id}
              selected={isSelected}
              onClick={() => handleSelectTab(item.id)}
              sx={{
                borderRadius: 3,
                mb: 1,
                py: 1.2,
                px: 2,
                transition: 'all 0.2s ease',
                bgcolor: isSelected ? alpha('#0284c7', 0.1) : 'transparent',
                color: isSelected ? 'primary.main' : 'text.primary',
                '&:hover': {
                  bgcolor: isSelected ? alpha('#0284c7', 0.15) : alpha('#000', 0.03),
                  transform: 'translateX(4px)',
                },
                '&.Mui-selected': {
                  bgcolor: alpha('#0284c7', 0.1),
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 38,
                  color: isSelected ? 'primary.main' : '#64748b',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: isSelected ? 700 : 500, fontSize: '0.9rem' }}>
                    {item.label}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" sx={{ fontSize: '0.72rem', color: isSelected ? 'primary.light' : 'text.secondary' }}>
                    {item.desc}
                  </Typography>
                }
              />
            </ListItemButton>
          );
        })}
      </List>

      {/* Bottom Master Stats */}
      <Box sx={{ mt: 'auto', p: 2, borderRadius: 3, bgcolor: '#f1f5f9', border: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <StorageRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
          <Typography variant="caption" sx={{ fontWeight: 800, color: '#1e293b' }}>
            Supabase Cloud Database
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'primary.main' }}>
          {masterItems.length} รายการบน Cloud
        </Typography>
        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
          iPad สแกนและจับคู่ข้อมูลผ่าน Supabase โดยตรง
        </Typography>
      </Box>
    </Box>
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-gradient)' }}>
        {/* Top AppBar */}
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            zIndex: (th) => th.zIndex.drawer + 1,
            bgcolor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
            color: '#0f172a',
          }}
        >
          <Toolbar sx={{ px: { xs: 2, sm: 3 } }}>
            <Tooltip title={desktopOpen ? 'ยุบเมนู Side Bar' : 'ขยายเมนู Side Bar'}>
              <IconButton
                color="inherit"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{
                  mr: 2,
                  borderRadius: 2.5,
                  bgcolor: alpha('#0284c7', 0.08),
                  color: 'primary.main',
                  transition: 'all 0.2s',
                  '&:hover': {
                    bgcolor: alpha('#0284c7', 0.16),
                  },
                }}
              >
                {desktopOpen ? <MenuOpenRoundedIcon /> : <MenuIcon />}
              </IconButton>
            </Tooltip>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
              <MedicationRoundedIcon sx={{ color: 'primary.main', fontSize: 26 }} />
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', display: { xs: 'none', md: 'block' } }}>
                Medicine Barcode Verification (Direct Supabase)
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, display: { xs: 'block', md: 'none' } }}>
                Medicine Verify
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Tooltip title="จำนวน Master Data บน Supabase Cloud">
                <Chip
                  label={`Supabase DB: ${masterItems.length}`}
                  color="primary"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              </Tooltip>
              <Chip
                label="iPad Ready"
                color="success"
                size="small"
                variant="outlined"
                sx={{ fontWeight: 700 }}
              />
            </Box>
          </Toolbar>
        </AppBar>

        {/* Sidebar Navigation */}
        <Box
          component="nav"
          sx={{
            width: { sm: desktopOpen ? drawerWidth : 0 },
            flexShrink: { sm: 0 },
            transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Mobile Drawer */}
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: 'block', sm: 'none' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerWidth,
                bgcolor: '#ffffff',
                borderRight: '1px solid #e2e8f0',
              },
            }}
          >
            {drawerContent}
          </Drawer>

          {/* Desktop Collapsible Drawer */}
          <Drawer
            variant="persistent"
            open={desktopOpen}
            sx={{
              display: { xs: 'none', sm: 'block' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: drawerWidth,
                bgcolor: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(12px)',
                borderRight: '1px solid rgba(226, 232, 240, 0.8)',
                transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              },
            }}
          >
            <Toolbar />
            {drawerContent}
          </Drawer>
        </Box>

        {/* Main Content Workspace */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, sm: 3, md: 4 },
            width: { sm: desktopOpen ? `calc(100% - ${drawerWidth}px)` : '100%' },
            transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), margin 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            mt: 8,
          }}
        >
          <Container maxWidth="xl" disableGutters>

            {/* TAB 1: IPAD SCAN CHECK (SEARCH IN SUPABASE) */}
            {currentTab === 'scan' && (
              <>
                <Grid container spacing={2.5} sx={{ mb: 3 }}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: 3.5,
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#059669' }}>
                          MATCHED / พบใน Supabase
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 800, color: '#065f46', mt: 0.5 }}>
                          {totalFound}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          จับคู่บาร์โค้ดยาได้ถูกต้องจาก Cloud
                        </Typography>
                      </Box>
                      <CheckCircleRoundedIcon sx={{ fontSize: 38, color: '#10b981' }} />
                    </Paper>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2.5,
                        borderRadius: 3.5,
                        border: '1px solid rgba(100, 116, 139, 0.2)',
                        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                          NOT FOUND / ไม่พบข้อมูล
                        </Typography>
                        <Typography variant="h4" sx={{ fontWeight: 800, color: '#334155', mt: 0.5 }}>
                          {totalNotFound}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ไม่มีรหัสนี้ในตาราง Supabase
                        </Typography>
                      </Box>
                      <WarningAmberRoundedIcon sx={{ fontSize: 38, color: '#64748b' }} />
                    </Paper>
                  </Grid>
                </Grid>

                {/* iPad Scanner View */}
                <IPadScanner
                  masterItems={masterItems}
                  onScanResult={handleScanResult}
                />

                {/* Recent Scan History */}
                {scanHistory.length > 0 && (
                  <Paper
                    elevation={0}
                    sx={{
                      borderRadius: 4,
                      p: 2.5,
                      border: '1px solid rgba(226, 232, 240, 0.8)',
                      bgcolor: '#ffffff',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        รายการที่เพิ่งสแกนตรวจสอบล่าสุด
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => setCurrentTab('history')}
                        endIcon={<ArrowForwardRoundedIcon />}
                      >
                        ดูประวัติทั้งหมด
                      </Button>
                    </Box>

                    <TableContainer>
                      <Table size="small">
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>เวลา</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>BARCODE ที่สแกน</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Code (รหัสยา)</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Name (ชื่อยา / สินค้า)</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>ชนิดยา</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>หน่วย</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>ผลการค้นหา</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {scanHistory.slice(0, 5).map((log, index) => (
                            <TableRow key={index} hover>
                              <TableCell sx={{ color: '#64748b' }}>{log.scanTimestamp}</TableCell>
                              <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace', color: 'primary.main' }}>
                                {log.scannedCode}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                                {log.item?.itemCode || '-'}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 600 }}>
                                {log.item ? log.item.itemName : '(ไม่พบใน Supabase)'}
                              </TableCell>
                              <TableCell>{log.item?.medicineType || '-'}</TableCell>
                              <TableCell>{log.item?.unitName || '-'}</TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={log.found ? 'MATCHED' : 'NOT FOUND'}
                                  size="small"
                                  sx={{
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    bgcolor: log.found ? alpha('#10b981', 0.12) : alpha('#64748b', 0.12),
                                    color: log.found ? '#059669' : '#475569',
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                )}
              </>
            )}

            {/* TAB 2: SUPABASE MASTER DATA */}
            {currentTab === 'master' && (
              <MasterDataView
                masterItems={masterItems}
                onRefreshFromSupabase={loadDataFromSupabase}
                isLoading={loadingMaster}
              />
            )}

            {/* TAB 3: SCAN HISTORY */}
            {currentTab === 'history' && (
              <Paper
                elevation={0}
                sx={{
                  borderRadius: 4,
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  bgcolor: '#ffffff',
                  p: 3,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 3,
                  }}
                >
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      Scan Verification Audit Logs
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ประวัติการยิง Barcode สินค้าเปรียบเทียบกับข้อมูลบน Supabase Database ทั้งหมด
                    </Typography>
                  </Box>

                  {scanHistory.length > 0 && (
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={handleClearHistory}
                      sx={{ borderRadius: 2 }}
                    >
                      ล้างประวัติการสแกน
                    </Button>
                  )}
                </Box>

                <TableContainer>
                  <Table>
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Timestamp</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>BARCODE ที่สแกน</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Code (รหัสยา)</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Name (ชื่อยา / สินค้า)</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>ชนิดยา (MEDICINE TYPE)</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Unit Name</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>สถานะ</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {scanHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                            <Typography variant="body1" color="text.secondary">
                              ยังไม่มีประวัติการสแกน — เปิดแท็บ "iPad Scan Check" เพื่อเริ่มสแกน Barcode
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        scanHistory.map((item, idx) => (
                          <TableRow key={idx} hover>
                            <TableCell sx={{ color: '#64748b' }}>{item.scanTimestamp}</TableCell>
                            <TableCell sx={{ fontWeight: 800, fontFamily: 'monospace', color: 'primary.main' }}>
                              {item.scannedCode}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                              {item.item?.itemCode || '-'}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>
                              {item.item ? item.item.itemName : '(ไม่พบข้อมูลใน Supabase)'}
                            </TableCell>
                            <TableCell>{item.item?.medicineType || '-'}</TableCell>
                            <TableCell>{item.item?.unitName || '-'}</TableCell>
                            <TableCell align="center">
                              <Chip
                                label={item.found ? 'MATCHED' : 'NOT FOUND'}
                                size="small"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: '0.75rem',
                                  bgcolor: item.found ? alpha('#10b981', 0.12) : alpha('#64748b', 0.12),
                                  color: item.found ? '#059669' : '#475569',
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}

          </Container>
        </Box>
      </Box>

      {/* Verification Feedback Modern Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{
            width: '100%',
            borderRadius: 3,
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            fontWeight: 600,
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
