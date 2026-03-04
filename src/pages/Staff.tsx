// src/pages/Staff.tsx
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
import SearchIcon from "@mui/icons-material/Search";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

type StaffStatus = "active" | "inactive";

type Branch = {
  id: number;
  name: string;
  status: string;
};

type Row = {
  id: number;
  branch_id: number;
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  specialty?: string | null;
  commission_rate: number;
  status: StaffStatus;
  created_at?: string | null;
};

function pct(v: any) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "-";
  return `${x.toFixed(2)}%`;
}

function StatusChip({ status }: { status: StaffStatus }) {
  const color = status === "active" ? "success" : "default";
  return (
    <Chip
      size="small"
      color={color}
      variant={status === "active" ? "filled" : "outlined"}
      label={status}
      sx={{ fontWeight: 800, textTransform: "capitalize" }}
    />
  );
}

function CommissionChip({ value }: { value: any }) {
  const x = Number(value);
  if (!Number.isFinite(x)) return <Chip size="small" label="—" variant="outlined" sx={{ fontWeight: 800 }} />;
  return (
    <Chip
      size="small"
      label={pct(x)}
      sx={{
        fontWeight: 900,
        bgcolor: "rgba(15,118,110,0.10)",
        color: "secondary.main",
      }}
    />
  );
}

export default function Staff() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const dialogFullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { me, activeBranchId } = useAuth();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [branches, setBranches] = useState<Branch[]>([]);

  // filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StaffStatus>("all");
  const [branchFilter, setBranchFilter] = useState<string>(""); // "" = current branch

  // dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  // form
  const [branch_id, setBranchId] = useState<string>(""); // branch selected in form
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [commission_rate, setCommissionRate] = useState<number>(0);
  const [status, setStatus] = useState<StaffStatus>("active");

  // toast
  const [toast, setToast] = useState<{ open: boolean; type: "success" | "error"; msg: string }>({
    open: false,
    type: "success",
    msg: "",
  });
  const notify = (type: "success" | "error", msg: string) => setToast({ open: true, type, msg });

  const fetchRows = async () => {
    setLoading(true);
    try {
      // Your backend GET /staff is scoped to active branch header (X-Branch-Id)
      const r = await api.get("/staff");
      setRows((r.data?.rows || []) as Row[]);
    } catch (e: any) {
      notify("error", e?.response?.data?.error || "Failed to load staff");
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      // Prefer /branches endpoint if present
      const r = await api.get("/branches");
      const list = (r.data?.rows || r.data?.branches || []) as Branch[];
      if (list.length) {
        setBranches(list);
        return;
      }
      // Fallback: use me.branches from /auth/me if /branches doesn't return
      if (me?.branches?.length) {
        setBranches(me.branches as any);
      }
    } catch {
      if (me?.branches?.length) setBranches(me.branches as any);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return rows.filter((r) => {
      const matchesQ =
        !qq ||
        `${r.first_name || ""} ${r.last_name || ""}`.toLowerCase().includes(qq) ||
        String(r.phone || "").toLowerCase().includes(qq) ||
        String(r.email || "").toLowerCase().includes(qq) ||
        String(r.specialty || "").toLowerCase().includes(qq);

      const matchesStatus = statusFilter === "all" ? true : r.status === statusFilter;

      // Branch filter:
      // "" means current branch header list already scoped, so keep all.
      // If user chooses a branch, filter by row.branch_id (only relevant if you later return multi-branch staff list)
      const matchesBranch = !branchFilter ? true : String(r.branch_id) === String(branchFilter);

      return matchesQ && matchesStatus && matchesBranch;
    });
  }, [rows, q, statusFilter, branchFilter]);

  const openCreate = () => {
    setEditing(null);
    setBranchId(activeBranchId || ""); // default to current branch
    setFirst("");
    setLast("");
    setPhone("");
    setEmail("");
    setSpecialty("");
    setCommissionRate(0);
    setStatus("active");
    setOpen(true);
  };

  const openEdit = (r: Row) => {
    setEditing(r);
    setBranchId(String(r.branch_id || activeBranchId || ""));
    setFirst(r.first_name || "");
    setLast(r.last_name || "");
    setPhone((r.phone as string) || "");
    setEmail((r.email as string) || "");
    setSpecialty((r.specialty as string) || "");
    setCommissionRate(Number(r.commission_rate || 0));
    setStatus(r.status || "active");
    setOpen(true);
  };

  const save = async () => {
    const payload: any = {
      branch_id: branch_id ? Number(branch_id) : undefined, // backend supports body branch_id
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      specialty: specialty.trim(),
      commission_rate: Number(commission_rate || 0),
      status,
    };

    if (!payload.first_name || !payload.last_name) {
      notify("error", "First name and last name are required");
      return;
    }
    if (!branch_id) {
      notify("error", "Please select a branch");
      return;
    }

    try {
      if (editing) await api.put(`/staff/${editing.id}`, payload);
      else await api.post("/staff", payload);

      notify("success", editing ? "Staff updated" : "Staff created");
      setOpen(false);

      // If staff was created/edited in another branch, your current GET /staff (scoped) might not show it.
      // Still refresh current list.
      fetchRows();
    } catch (e: any) {
      notify("error", e?.response?.data?.error || "Save failed");
    }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this staff?")) return;
    try {
      await api.delete(`/staff/${id}`);
      notify("success", "Staff deleted");
      fetchRows();
    } catch (e: any) {
      notify("error", e?.response?.data?.error || "Delete failed");
    }
  };

  function ActionsCell({ row }: { row: Row }) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const openMenu = Boolean(anchorEl);

    if (!isMobile) {
      return (
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ width: "100%" }}>
          <Button size="small" variant="outlined" onClick={() => openEdit(row)}>
            Edit
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
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              openEdit(row);
            }}
          >
            Edit
          </MenuItem>
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
        field: "name",
        headerName: "Staff",
        flex: 1.6,
        minWidth: 220,
        valueGetter: (_v, row: Row) => `${row.first_name || ""} ${row.last_name || ""}`.trim(),
        renderCell: (p: GridRenderCellParams<any, any, any, any>) => (
          <Stack spacing={0.3} sx={{ py: 0.5 }}>
            <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>
              {`${(p.row as Row).first_name || ""} ${(p.row as Row).last_name || ""}`.trim()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {(p.row as Row).specialty ? `Specialty: ${(p.row as Row).specialty}` : "—"}
            </Typography>
          </Stack>
        ),
      },
      { field: "phone", headerName: "Phone", flex: 1.0, minWidth: 140 },
      { field: "email", headerName: "Email", flex: 1.2, minWidth: 190 },
      {
        field: "commission_rate",
        headerName: "Commission",
        flex: 0.9,
        minWidth: 140,
        renderCell: (p: GridRenderCellParams<any>) => <CommissionChip value={p.value} />,
        sortable: true,
      },
      {
        field: "status",
        headerName: "Status",
        flex: 0.9,
        minWidth: 120,
        renderCell: (p: GridRenderCellParams<any>) => <StatusChip status={(p.value || "active") as any} />,
      },
      {
        field: "actions",
        headerName: "",
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        flex: 0.9,
        minWidth: 120,
        align: "right",
        headerAlign: "right",
        renderCell: (p: GridRenderCellParams<any, any, any, any>) => <ActionsCell row={p.row as Row} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMobile, rows]
  );

  const branchOptions = branches.filter((b) => b.status !== "inactive");
  const currentBranchName =
    branchOptions.find((b) => String(b.id) === String(activeBranchId))?.name || "Current branch";

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
            Staff
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Staff per branch • Base commission rate
          </Typography>
        </Box>

        <Button variant="contained" onClick={openCreate} sx={{ fontWeight: 900 }}>
          + Add Staff
        </Button>
      </Stack>

      {/* Filters */}
      <Card sx={{ borderRadius: 4, mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
            <TextField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name / phone / email / specialty"
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
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              sx={{ minWidth: { xs: "100%", sm: 160 } }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="inactive">inactive</MenuItem>
            </TextField>

            {/* optional branch filter (mostly future-proof; GET /staff is already scoped by header) */}
            <TextField
              select
              size="small"
              label="Branch"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              sx={{ minWidth: { xs: "100%", sm: 220 } }}
            >
              <MenuItem value="">
                Current: {currentBranchName}
              </MenuItem>
              {branchOptions.map((b) => (
                <MenuItem key={b.id} value={String(b.id)}>
                  {b.name}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ flex: 1 }} />

            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {filtered.length} staff
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
              noRowsLabel: "No staff yet. Click “Add Staff” to create your first record.",
            }}
          />
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" fullScreen={dialogFullScreen}>
        <DialogTitle sx={{ fontWeight: 900 }}>{editing ? "Edit Staff" : "Add Staff"}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Branch"
              value={branch_id}
              onChange={(e) => setBranchId(e.target.value)}
              helperText="Required — staff must belong to a branch"
            >
              {branchOptions.map((b) => (
                <MenuItem key={b.id} value={String(b.id)}>
                  {b.name}
                </MenuItem>
              ))}
            </TextField>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="First Name" value={first_name} onChange={(e) => setFirst(e.target.value)} fullWidth />
              <TextField label="Last Name" value={last_name} onChange={(e) => setLast(e.target.value)} fullWidth />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} fullWidth />
              <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth />
            </Stack>

            <TextField label="Specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />

            <TextField
              label="Commission %"
              type="number"
              value={commission_rate}
              onChange={(e) => setCommissionRate(Number(e.target.value))}
              inputProps={{ min: 0, max: 100, step: "0.01" }}
              helperText="Used if service commission is blank"
            />

            <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="inactive">inactive</MenuItem>
            </TextField>

            {Number(commission_rate) > 50 && (
              <Alert severity="info" variant="outlined">
                Commission above <b>50%</b> — just confirm this is intended.
              </Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} variant="text" fullWidth={dialogFullScreen}>
            Cancel
          </Button>
          <Button onClick={save} variant="contained" sx={{ fontWeight: 900 }} fullWidth={dialogFullScreen}>
            Save
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