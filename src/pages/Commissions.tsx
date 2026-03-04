// src/pages/Commissions.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PaidIcon from "@mui/icons-material/Paid";
import RefreshIcon from "@mui/icons-material/Refresh";
import { api } from "../lib/api";

type Staff = { id: number; first_name: string; last_name: string; status: string };

type Row = {
  id: number;
  staff_id: number;
  staff_name?: string | null; // if backend sends
  appointment_id: number;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  created_at?: string | null;
};

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function inRange(dt: Date, from: Date, to: Date) {
  const t = dt.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function fmtDT(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function money(v: any) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

function pct(v: any) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "0.00%";
  return `${x.toFixed(2)}%`;
}

function RateChip({ value }: { value: any }) {
  const x = Number(value);
  if (!Number.isFinite(x)) return <Chip size="small" label="—" variant="outlined" sx={{ fontWeight: 900 }} />;
  return (
    <Chip
      size="small"
      label={pct(x)}
      sx={{ fontWeight: 900, bgcolor: "rgba(15,118,110,0.10)", color: "secondary.main" }}
    />
  );
}

export default function Commissions() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const dialogFullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Staff[]>([]);

  // filters
  const [q, setQ] = useState("");
  const [staffFilter, setStaffFilter] = useState<string>("all");

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return isoDate(d);
  });
  const [to, setTo] = useState(() => isoDate(new Date()));

  // toast
  const [toast, setToast] = useState<{ open: boolean; type: "success" | "error"; msg: string }>({
    open: false,
    type: "success",
    msg: "",
  });
  const notify = (type: "success" | "error", msg: string) => setToast({ open: true, type, msg });

  // recompute dialog (optional)
  const [recomputeOpen, setRecomputeOpen] = useState(false);
  const [recomputeApptId, setRecomputeApptId] = useState<number | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const r = await api.get("/commissions");
      setRows((r.data?.rows || []) as Row[]);
    } catch (e: any) {
      notify("error", e?.response?.data?.error || "Failed to load commissions");
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const r = await api.get("/staff");
      setStaff((r.data?.rows || []) as Staff[]);
    } catch {
      setStaff([]);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const range = useMemo(() => {
    const f = parseYmd(from);
    const t = parseYmd(to);
    t.setHours(23, 59, 59, 999);
    return { f, t };
  }, [from, to]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return rows.filter((r) => {
      // date filter uses created_at if present; else allow all
      const dt = r.created_at ? new Date(String(r.created_at).replace(" ", "T")) : null;
      const matchesDate = dt && !Number.isNaN(dt.getTime()) ? inRange(dt, range.f, range.t) : true;

      const name = String(r.staff_name || "").toLowerCase();
      const matchesQ =
        !qq ||
        name.includes(qq) ||
        String(r.appointment_id || "").includes(qq) ||
        String(r.id).includes(qq);

      const matchesStaff = staffFilter === "all" ? true : String(r.staff_id) === String(staffFilter);

      return matchesDate && matchesQ && matchesStaff;
    });
  }, [rows, q, staffFilter, range.f, range.t]);

  const stats = useMemo(() => {
    const count = filtered.length;
    const gross = filtered.reduce((acc, r) => acc + Number(r.gross_amount || 0), 0);
    const comm = filtered.reduce((acc, r) => acc + Number(r.commission_amount || 0), 0);
    const avgRate = gross > 0 ? (comm / gross) * 100 : 0;
    return { count, gross, comm, avgRate };
  }, [filtered]);

  const staffNameMap = useMemo(() => {
    const m = new Map<number, string>();
    staff.forEach((s) => m.set(s.id, `${s.first_name} ${s.last_name}`.trim()));
    return m;
  }, [staff]);

  const del = async (id: number) => {
    if (!confirm("Delete this commission record?")) return;
    try {
      await api.delete(`/commissions/${id}`);
      notify("success", "Commission deleted");
      fetchRows();
    } catch (e: any) {
      notify("error", e?.response?.data?.error || "Delete failed");
    }
  };

  const recompute = async (appointmentId: number) => {
    try {
      // This triggers your backend: status=completed -> calculate_commission()
      await api.put(`/appointments/${appointmentId}/status`, { status: "completed" });
      notify("success", "Commission recomputed");
      fetchRows();
    } catch (e: any) {
      notify("error", e?.response?.data?.error || "Recompute failed");
    }
  };

  function ActionsCell({ row }: { row: Row }) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const openMenu = Boolean(anchorEl);

    const onRecompute = () => {
      setAnchorEl(null);
      setRecomputeApptId(row.appointment_id);
      setRecomputeOpen(true);
    };

    if (!isMobile) {
      return (
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ width: "100%" }}>
          <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={onRecompute}>
            Recompute
          </Button>
          <Button size="small" color="error" variant="outlined" onClick={() => del(row.id)}>
            Delete
          </Button>
        </Stack>
      );
    }

    return (
      <>
        <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={anchorEl} open={openMenu} onClose={() => setAnchorEl(null)}>
          <MenuItem onClick={onRecompute}>Recompute</MenuItem>
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              del(row.id);
            }}
            sx={{ color: "error.main" }}
          >
            Delete
          </MenuItem>
        </Menu>
      </>
    );
  }

  const cols: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", flex: 0.45, minWidth: 70 },
      {
        field: "created_at",
        headerName: "Created",
        flex: 1.15,
        minWidth: 180,
        valueFormatter: (p: any) => fmtDT(p.value),
      },
      {
        field: "staff_id",
        headerName: "Staff",
        flex: 1.2,
        minWidth: 180,
        valueGetter: (_v, row: Row) => row.staff_name || staffNameMap.get(row.staff_id) || `#${row.staff_id}`,
        renderCell: (p: GridRenderCellParams<any, any, any, any>) => (
          <Typography sx={{ fontWeight: 900 }}>
            {(p.row as Row).staff_name || staffNameMap.get((p.row as Row).staff_id) || `#${(p.row as Row).staff_id}`}
          </Typography>
        ),
      },
      {
        field: "appointment_id",
        headerName: "Appt #",
        flex: 0.7,
        minWidth: 110,
      },
      {
        field: "gross_amount",
        headerName: "Gross",
        flex: 0.9,
        minWidth: 140,
        type: "number",
        renderCell: (p: GridRenderCellParams<any>) => (
          <Typography sx={{ fontWeight: 900 }}>₱{money(p.value)}</Typography>
        ),
      },
      {
        field: "commission_rate",
        headerName: "Rate",
        flex: 0.8,
        minWidth: 120,
        renderCell: (p: GridRenderCellParams<any>) => <RateChip value={p.value} />,
      },
      {
        field: "commission_amount",
        headerName: "Commission",
        flex: 1,
        minWidth: 160,
        type: "number",
        renderCell: (p: GridRenderCellParams<any>) => (
          <Typography sx={{ fontWeight: 900 }}>₱{money(p.value)}</Typography>
        ),
      },
      {
        field: "actions",
        headerName: "",
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        flex: 0.95,
        minWidth: 160,
        align: "right",
        headerAlign: "right",
        renderCell: (p: GridRenderCellParams<any, any, any, any>) => <ActionsCell row={p.row as Row} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMobile, rows, staffNameMap]
  );

  const staffOptions = staff.filter((s) => (s.status || "active") === "active");

  return (
    <Box>
      {/* Header */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Commissions
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Payouts per branch • Filter by date range
          </Typography>
        </Box>

        <Button variant="outlined" onClick={fetchRows} sx={{ fontWeight: 900 }}>
          Refresh
        </Button>
      </Stack>

      {/* Summary chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Chip label={`Count: ${stats.count}`} sx={{ fontWeight: 800 }} />
        <Chip label={`Gross: ₱${money(stats.gross)}`} variant="outlined" sx={{ fontWeight: 800 }} />
        <Chip label={`Commission: ₱${money(stats.comm)}`} color="success" variant="outlined" sx={{ fontWeight: 800 }} />
        <Chip label={`Avg rate: ${pct(stats.avgRate)}`} variant="outlined" sx={{ fontWeight: 800 }} />
      </Stack>

      {/* Filters */}
      <Card sx={{ borderRadius: 4, mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" } }}>
            <TextField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search staff / appointment id"
              size="small"
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              select
              size="small"
              label="Staff"
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              sx={{ minWidth: { xs: "100%", md: 240 } }}
            >
              <MenuItem value="all">All staff</MenuItem>
              {staffOptions.map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>
                  {`${s.first_name} ${s.last_name}`.trim()}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="From"
              type="date"
              size="small"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: { xs: "100%", md: 160 } }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: { xs: "100%", md: 160 } }}
            />

            <Box sx={{ flex: 1 }} />

            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {filtered.length} record{filtered.length === 1 ? "" : "s"}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Table */}
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <DataGrid
            autoHeight
            rows={filtered}
            columns={cols}
            loading={loading}
            disableRowSelectionOnClick
            disableColumnMenu
            density="compact"
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
            sx={{
              border: 0,
              "& .MuiDataGrid-cell": { outline: "none" },
              "& .MuiDataGrid-columnHeaders": { borderRadius: 2 },
            }}
            localeText={{
              noRowsLabel: "No commissions found for the selected date range.",
            }}
          />
        </CardContent>
      </Card>

      {/* Recompute confirm */}
      <Dialog open={recomputeOpen} onClose={() => setRecomputeOpen(false)} fullWidth maxWidth="xs" fullScreen={dialogFullScreen}>
        <DialogTitle sx={{ fontWeight: 900 }}>Recompute commission?</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Alert severity="info" variant="outlined">
            This will re-run commission calculation for appointment <b>#{recomputeApptId}</b> by setting status to{" "}
            <b>completed</b> again.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRecomputeOpen(false)} variant="text" fullWidth={dialogFullScreen}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (recomputeApptId) recompute(recomputeApptId);
              setRecomputeOpen(false);
            }}
            variant="contained"
            sx={{ fontWeight: 900 }}
            startIcon={<RefreshIcon />}
            fullWidth={dialogFullScreen}
          >
            Recompute
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={2500}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.type} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}