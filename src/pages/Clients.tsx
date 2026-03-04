// src/pages/Clients.tsx
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

type ClientStatus = "active" | "inactive";

type Row = {
  id: number;
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  status: ClientStatus;
  created_at?: string | null;
};

function fmtDate(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString();
}

function StatusChip({ status }: { status: ClientStatus }) {
  const color = status === "active" ? "success" : "default";
  return (
    <Chip
      size="small"
      color={color}
      variant={status === "active" ? "filled" : "outlined"}
      label={status}
      sx={{ fontWeight: 700, textTransform: "capitalize" }}
    />
  );
}

export default function Clients() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const dialogFullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ClientStatus>("all");

  // dialog state
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  // form state
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<ClientStatus>("active");

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
      const r = await api.get("/clients");
      setRows((r.data?.rows || []) as Row[]);
    } catch (e: any) {
      notify("error", e?.response?.data?.error || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQ =
        !qq ||
        `${r.first_name || ""} ${r.last_name || ""}`.toLowerCase().includes(qq) ||
        String(r.phone || "").toLowerCase().includes(qq) ||
        String(r.email || "").toLowerCase().includes(qq);

      const matchesStatus = statusFilter === "all" ? true : r.status === statusFilter;
      return matchesQ && matchesStatus;
    });
  }, [rows, q, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setFirst("");
    setLast("");
    setPhone("");
    setEmail("");
    setStatus("active");
    setOpen(true);
  };

  const openEdit = (r: Row) => {
    setEditing(r);
    setFirst(r.first_name || "");
    setLast(r.last_name || "");
    setPhone((r.phone as string) || "");
    setEmail((r.email as string) || "");
    setStatus(r.status || "active");
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      status,
    };

    if (!payload.first_name || !payload.last_name) {
      notify("error", "First name and last name are required");
      return;
    }

    try {
      if (editing) await api.put(`/clients/${editing.id}`, payload);
      else await api.post("/clients", payload);

      notify("success", editing ? "Client updated" : "Client created");
      setOpen(false);
      fetchRows();
    } catch (e: any) {
      notify("error", e?.response?.data?.error || "Save failed");
    }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this client?")) return;
    try {
      await api.delete(`/clients/${id}`);
      notify("success", "Client deleted");
      fetchRows();
    } catch (e: any) {
      notify("error", e?.response?.data?.error || "Delete failed");
    }
  };

  // Actions cell (mobile menu / desktop buttons)
  function ActionsCell({ row }: { row: Row }) {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const openMenu = Boolean(anchorEl);

    if (!isMobile) {
      return (
        <Stack direction="row" spacing={1}>
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

  const cols = useMemo<GridColDef[]>(() => [
      { field: "id", headerName: "ID", flex: 0.4, minWidth: 70 },
      {
        field: "name",
        headerName: "Client",
        flex: 1.4,
        minWidth: 190,
        valueGetter: (_v, row: Row) => `${row.first_name || ""} ${row.last_name || ""}`.trim(),
      },
      { field: "phone", headerName: "Phone", flex: 1, minWidth: 140 },
      { field: "email", headerName: "Email", flex: 1.3, minWidth: 200 },
      {
        field: "status",
        headerName: "Status",
        flex: 0.8,
        minWidth: 120,
        renderCell: (p: GridRenderCellParams<any, Row>) => <StatusChip status={(p.value || "active") as ClientStatus} />,
      },
      {
        field: "created_at",
        headerName: "Created",
        flex: 1.1,
        minWidth: 170,
        valueFormatter: (p: any) => fmtDate(p.value),
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
        renderCell: (p: GridRenderCellParams<any, any, any>) => <ActionsCell row={p.row as Row} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMobile, rows]
  );

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
            Clients
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage client records per branch
          </Typography>
        </Box>

        <Button variant="contained" onClick={openCreate} sx={{ fontWeight: 900 }}>
          + Add Client
        </Button>
      </Stack>

      {/* Filters */}
      <Card sx={{ borderRadius: 4, mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
            <TextField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name / phone / email"
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
              sx={{ minWidth: { xs: "100%", sm: 180 } }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="inactive">inactive</MenuItem>
            </TextField>

            <Box sx={{ flex: 1 }} />

            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {filtered.length} client{filtered.length === 1 ? "" : "s"}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Table */}
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Box sx={{ width: "100%" }}>
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
                "& .MuiDataGrid-columnHeaders": { borderRadius: 2 },
                "& .MuiDataGrid-cell": { outline: "none" },
              }}
              localeText={{
                noRowsLabel: "No clients yet. Click “Add Client” to create your first record.",
              }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" fullScreen={dialogFullScreen}>
        <DialogTitle sx={{ fontWeight: 900 }}>{editing ? "Edit Client" : "Add Client"}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="First Name" value={first_name} onChange={(e) => setFirst(e.target.value)} />
            <TextField label="Last Name" value={last_name} onChange={(e) => setLast(e.target.value)} />
            <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

            <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="inactive">inactive</MenuItem>
            </TextField>
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