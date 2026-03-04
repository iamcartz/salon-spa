// src/pages/Appointments.tsx
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
import EventIcon from "@mui/icons-material/Event";
import { api } from "../lib/api";

type Status = "booked" | "checked_in" | "completed" | "cancelled" | "no_show";

type Row = {
  id: number;
  client_id: number;
  staff_id: number;
  client_name: string;
  staff_name: string;
  start_at: string;
  end_at: string;
  status: Status;
  notes?: string | null;
};

type Client = { id: number; first_name: string; last_name: string; status: string };
type Staff = { id: number; first_name: string; last_name: string; status: string };
type Service = { id: number; name: string; price: number; status: string; category?: string };

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

function fmtDT(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function toLocalInputValue(isoOrMysql: string) {
  // Accepts ISO or "YYYY-MM-DD HH:mm:ss"
  const d = new Date(isoOrMysql.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function statusColor(s: Status): "default" | "info" | "success" | "warning" | "error" {
  if (s === "completed") return "success";
  if (s === "checked_in") return "info";
  if (s === "cancelled") return "error";
  if (s === "no_show") return "warning";
  return "default"; // booked
}

function StatusChip({ status }: { status: Status }) {
  return (
    <Chip
      size="small"
      label={status.replace("_", " ")}
      color={statusColor(status)}
      variant={status === "booked" ? "outlined" : "filled"}
      sx={{ fontWeight: 800, textTransform: "capitalize" }}
    />
  );
}

export default function Appointments() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const dialogFullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");

  // date range
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return isoDate(d);
  });
  const [to, setTo] = useState(() => isoDate(new Date()));

  // dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  // form
  const [client_id, setClientId] = useState<string>("");
  const [staff_id, setStaffId] = useState<string>("");
  const [start_at, setStartAt] = useState<string>("");
  const [end_at, setEndAt] = useState<string>("");
  const [status, setStatus] = useState<Status>("booked");
  const [notes, setNotes] = useState<string>("");
  const [service_ids, setServiceIds] = useState<number[]>([]);

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
      const r = await api.get("/appointments");
      setRows((r.data?.rows || []) as Row[]);
    } catch (e: any) {
      notify("error", e?.response?.data?.error || "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [c, s, sv] = await Promise.all([api.get("/clients"), api.get("/staff"), api.get("/services")]);
      setClients((c.data?.rows || []) as Client[]);
      setStaff((s.data?.rows || []) as Staff[]);
      setServices((sv.data?.rows || []) as Service[]);
    } catch {
      // if any fail, still show page; dropdowns might be empty
    }
  };

  useEffect(() => {
    fetchLookups();
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
      const dt = new Date(r.start_at);
      const matchesDate = !Number.isNaN(dt.getTime()) ? inRange(dt, range.f, range.t) : true;

      const matchesQ =
        !qq ||
        String(r.client_name || "").toLowerCase().includes(qq) ||
        String(r.staff_name || "").toLowerCase().includes(qq) ||
        String(r.notes || "").toLowerCase().includes(qq) ||
        String(r.id).includes(qq);

      const matchesStatus = statusFilter === "all" ? true : r.status === statusFilter;
      const matchesStaff = staffFilter === "all" ? true : String(r.staff_id) === String(staffFilter);

      return matchesDate && matchesQ && matchesStatus && matchesStaff;
    });
  }, [rows, q, statusFilter, staffFilter, range.f, range.t]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const completed = filtered.filter((r) => r.status === "completed").length;
    const booked = filtered.filter((r) => r.status === "booked").length;
    const checkedIn = filtered.filter((r) => r.status === "checked_in").length;
    return { total, completed, booked, checkedIn };
  }, [filtered]);

  const openCreate = () => {
    setEditing(null);
    setClientId("");
    setStaffId("");
    setStartAt("");
    setEndAt("");
    setStatus("booked");
    setNotes("");
    setServiceIds([]);
    setOpen(true);
  };

  const openEdit = async (r: Row) => {
    setEditing(r);
    setClientId(String(r.client_id));
    setStaffId(String(r.staff_id));
    setStartAt(toLocalInputValue(r.start_at));
    setEndAt(toLocalInputValue(r.end_at));
    setStatus(r.status);
    setNotes((r.notes as string) || "");

    // Load service_ids for appointment
    try {
      const items = await api.get(`/appointments/${r.id}/items`);
      const ids = (items.data?.items || []).map((x: any) => Number(x.service_id)).filter((x: any) => Number.isFinite(x));
      setServiceIds(ids);
    } catch {
      setServiceIds([]);
    }

    setOpen(true);
  };

  const save = async () => {
    const payload = {
      client_id: Number(client_id || 0),
      staff_id: Number(staff_id || 0),
      start_at: start_at ? start_at.replace("T", " ") + ":00" : "",
      end_at: end_at ? end_at.replace("T", " ") + ":00" : "",
      status,
      notes,
      service_ids,
    };

    if (payload.client_id <= 0 || payload.staff_id <= 0) {
      notify("error", "Please select client and staff");
      return;
    }
    if (!payload.start_at || !payload.end_at) {
      notify("error", "Start and end date/time are required");
      return;
    }
    if (!Array.isArray(payload.service_ids) || payload.service_ids.length === 0) {
      notify("error", "Please select at least one service");
      return;
    }

    // basic validation
    const s = new Date(payload.start_at.replace(" ", "T"));
    const e = new Date(payload.end_at.replace(" ", "T"));
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e.getTime() <= s.getTime()) {
      notify("error", "End time must be after start time");
      return;
    }

    try {
      if (editing) await api.put(`/appointments/${editing.id}`, payload);
      else await api.post("/appointments", payload);

      notify("success", editing ? "Appointment updated" : "Appointment created");
      setOpen(false);
      fetchRows();
    } catch (e: any) {
      notify("error", e?.response?.data?.error || "Save failed");
    }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this appointment?")) return;
    try {
      await api.delete(`/appointments/${id}`);
      notify("success", "Appointment deleted");
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
      { field: "id", headerName: "ID", flex: 0.45, minWidth: 70 } as GridColDef,
      {
        field: "start_at",
        headerName: "Schedule",
        flex: 1.4,
        minWidth: 220,
        renderCell: (p: GridRenderCellParams<any, any, any, any>) => (
          <Stack spacing={0.4} sx={{ py: 0.5 }}>
            <Typography sx={{ fontWeight: 900, lineHeight: 1.2 }}>{fmtDT(p.row.start_at)}</Typography>
            <Typography variant="caption" color="text.secondary">
              to {fmtDT(p.row.end_at)}
            </Typography>
          </Stack>
        ),
      } as GridColDef,
      {
        field: "client_name",
        headerName: "Client",
        flex: 1.2,
        minWidth: 170,
        renderCell: (p: GridRenderCellParams<any, any, any, any>) => (
          <Typography sx={{ fontWeight: 800 }}>{p.row.client_name}</Typography>
        ),
      } as GridColDef,
      { field: "staff_name", headerName: "Staff", flex: 1.1, minWidth: 160 } as GridColDef,
      {
        field: "status",
        headerName: "Status",
        flex: 0.9,
        minWidth: 140,
        renderCell: (p: GridRenderCellParams<any>) => <StatusChip status={(p.value || "booked") as Status} />,
      } as GridColDef,
      {
        field: "notes",
        headerName: "Notes",
        flex: 1.4,
        minWidth: 220,
        valueFormatter: (p: any) => (p.value ? String(p.value) : "—"),
      } as GridColDef,
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
      } as GridColDef,
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isMobile, rows]
  );

  const staffOptions = staff.filter((s) => (s.status || "active") === "active");
  const clientOptions = clients.filter((c) => (c.status || "active") === "active");
  const serviceOptions = services.filter((s) => (s.status || "active") === "active");

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
            Appointments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Bookings per branch • Filter by date range
          </Typography>
        </Box>

        <Button variant="contained" onClick={openCreate} sx={{ fontWeight: 900 }} startIcon={<EventIcon />}>
          + Add Appointment
        </Button>
      </Stack>

      {/* Summary chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Chip label={`Total: ${stats.total}`} sx={{ fontWeight: 800 }} />
        <Chip label={`Booked: ${stats.booked}`} variant="outlined" sx={{ fontWeight: 800 }} />
        <Chip label={`Checked-in: ${stats.checkedIn}`} color="info" variant="outlined" sx={{ fontWeight: 800 }} />
        <Chip label={`Completed: ${stats.completed}`} color="success" variant="outlined" sx={{ fontWeight: 800 }} />
      </Stack>

      {/* Filters */}
      <Card sx={{ borderRadius: 4, mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" } }}>
            <TextField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search client / staff / notes / ID"
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
              sx={{ minWidth: { xs: "100%", md: 170 } }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="booked">booked</MenuItem>
              <MenuItem value="checked_in">checked in</MenuItem>
              <MenuItem value="completed">completed</MenuItem>
              <MenuItem value="cancelled">cancelled</MenuItem>
              <MenuItem value="no_show">no show</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Staff"
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              sx={{ minWidth: { xs: "100%", md: 220 } }}
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
              {filtered.length} appointment{filtered.length === 1 ? "" : "s"}
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
              noRowsLabel: "No appointments yet. Click “Add Appointment” to create your first booking.",
            }}
          />
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" fullScreen={dialogFullScreen}>
        <DialogTitle sx={{ fontWeight: 900 }}>{editing ? "Edit Appointment" : "Add Appointment"}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Client"
              value={client_id}
              onChange={(e) => setClientId(e.target.value)}
              helperText="Client must be in this branch"
            >
              {clientOptions.map((c) => (
                <MenuItem key={c.id} value={String(c.id)}>
                  {`${c.first_name} ${c.last_name}`.trim()}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Staff"
              value={staff_id}
              onChange={(e) => setStaffId(e.target.value)}
              helperText="Staff must be in this branch"
            >
              {staffOptions.map((s) => (
                <MenuItem key={s.id} value={String(s.id)}>
                  {`${s.first_name} ${s.last_name}`.trim()}
                </MenuItem>
              ))}
            </TextField>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Start"
                type="datetime-local"
                value={start_at}
                onChange={(e) => setStartAt(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="End"
                type="datetime-local"
                value={end_at}
                onChange={(e) => setEndAt(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>

            <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <MenuItem value="booked">booked</MenuItem>
              <MenuItem value="checked_in">checked in</MenuItem>
              <MenuItem value="completed">completed</MenuItem>
              <MenuItem value="cancelled">cancelled</MenuItem>
              <MenuItem value="no_show">no show</MenuItem>
            </TextField>

            <TextField
              select
              label="Services"
              SelectProps={{
                multiple: true,
                value: service_ids,
                onChange: (e) => {
                  const v = e.target.value as any;
                  const arr = Array.isArray(v) ? v : [v];
                  setServiceIds(arr.map((x) => Number(x)).filter((x) => Number.isFinite(x)));
                },
              }}
              helperText="Select one or multiple services"
            >
              {serviceOptions.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.category ? `[${s.category}] ` : ""}
                  {s.name} — ₱{Number(s.price || 0).toFixed(2)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              minRows={2}
              placeholder="Optional notes (preferences, reminders, etc.)"
            />

            {status === "completed" && (
              <Alert severity="info" variant="outlined">
                Marking as <b>completed</b> will compute commission (based on your backend logic).
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