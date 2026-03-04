// src/pages/Appointments.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { api } from "../lib/api";

type Client = { id: number; first_name: string; last_name: string };
type Staff = { id: number; first_name: string; last_name: string; commission_rate: number };
type Service = { id: number; name: string; price: number; commission_rate: number | null; duration_mins: number };

type Row = {
  id: number;
  client_id: number;
  staff_id: number;
  client_name: string;
  staff_name: string;
  start_at: string;
  end_at: string;
  status: "booked" | "checked_in" | "completed" | "cancelled" | "no_show";
  notes?: string;
};

const statusOptions: Row["status"][] = ["booked", "checked_in", "completed", "cancelled", "no_show"];

function fmtLocal(dt: string) {
  // dt is ISO-like "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm"
  // keep it simple for MVP: display as-is
  return dt?.replace("T", " ");
}

export default function Appointments() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // lookup lists
  const [clients, setClients] = useState<Client[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  // form
  const [client_id, setClientId] = useState<number>(0);
  const [staff_id, setStaffId] = useState<number>(0);
  const [start_at, setStartAt] = useState<string>("");
  const [end_at, setEndAt] = useState<string>("");
  const [status, setStatus] = useState<Row["status"]>("booked");
  const [notes, setNotes] = useState<string>("");

  // services selection (MVP: single service or multi by IDs)
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [serviceIdInput, setServiceIdInput] = useState<number>(0);

  const cols: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", flex: 1,minWidth: 90 },
      { field: "client_name", headerName: "Client",flex: 1,minWidth: 220 },
      { field: "staff_name", headerName: "Staff", flex: 1,minWidth: 220 },
      { field: "start_at", headerName: "Start", flex: 1,minWidth: 190, valueFormatter: (p: any) => fmtLocal(String(p.value || "")) },
      { field: "end_at", headerName: "End", flex: 1,minWidth: 190, valueFormatter: (p: any) => fmtLocal(String(p.value || "")) },
      { field: "status", headerName: "Status", flex: 1,minWidth: 140 },
      { field: "notes", headerName: "Notes", flex: 1, minWidth: 220 },
    ],
    []
  );

  const fetchLookups = async () => {
    const [c, s, sv] = await Promise.all([api.get("/clients"), api.get("/staff"), api.get("/services")]);
    setClients((c.data.rows || []).map((r: any) => ({ id: r.id, first_name: r.first_name, last_name: r.last_name })));
    setStaff((s.data.rows || []).map((r: any) => ({ id: r.id, first_name: r.first_name, last_name: r.last_name, commission_rate: r.commission_rate })));
    setServices((sv.data.rows || []).map((r: any) => ({ id: r.id, name: r.name, price: Number(r.price || 0), commission_rate: r.commission_rate === null ? null : Number(r.commission_rate), duration_mins: Number(r.duration_mins || 60) })));
  };

  const fetchRows = async () => {
    setLoading(true);
    try {
      const r = await api.get("/appointments");
      setRows(r.data.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchLookups();
      await fetchRows();
    })();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setClientId(clients[0]?.id || 0);
    setStaffId(staff[0]?.id || 0);
    setStartAt("");
    setEndAt("");
    setStatus("booked");
    setNotes("");
    setServiceIds([]);
    setServiceIdInput(services[0]?.id || 0);
    setOpen(true);
  };

  const openEdit = async (r: Row) => {
    setEditing(r);
    setClientId(r.client_id);
    setStaffId(r.staff_id);
    setStartAt(r.start_at?.replace(" ", "T")?.slice(0, 16) || "");
    setEndAt(r.end_at?.replace(" ", "T")?.slice(0, 16) || "");
    setStatus(r.status);
    setNotes(r.notes || "");

    // load items
    const items = await api.get(`/appointments/${r.id}/items`);
    setServiceIds((items.data.items || []).map((x: any) => Number(x.service_id)));
    setServiceIdInput(services[0]?.id || 0);

    setOpen(true);
  };

  const addService = () => {
    if (!serviceIdInput) return;
    if (serviceIds.includes(serviceIdInput)) return;
    setServiceIds([...serviceIds, serviceIdInput]);
  };

  const removeService = (id: number) => {
    setServiceIds(serviceIds.filter((x) => x !== id));
  };

  const save = async () => {
    if (!client_id || !staff_id) {
      alert("Client and Staff are required.");
      return;
    }
    if (!start_at || !end_at) {
      alert("Start and End date/time are required.");
      return;
    }
    if (serviceIds.length === 0) {
      alert("Please add at least 1 service.");
      return;
    }

    const payload = {
      client_id,
      staff_id,
      start_at: start_at.replace("T", " ") + ":00",
      end_at: end_at.replace("T", " ") + ":00",
      status,
      notes,
      service_ids: serviceIds,
    };

    if (editing) await api.put(`/appointments/${editing.id}`, payload);
    else await api.post("/appointments", payload);

    setOpen(false);
    fetchRows();
  };

  const del = async (id: number) => {
    if (!confirm("Delete this appointment?")) return;
    await api.delete(`/appointments/${id}`);
    fetchRows();
  };

  const setApptStatus = async (id: number, next: Row["status"]) => {
    await api.put(`/appointments/${id}/status`, { status: next });
    fetchRows();
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Appointments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Branch-scoped bookings (auto commission created when marked completed)
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate} sx={{ fontWeight: 800 }}>
          + Add Appointment
        </Button>
      </Box>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Box sx={{ height: 560 }}>
            <DataGrid
              rows={rows}
              columns={[
                ...cols,
                {
                  field: "quick",
                  headerName: "Quick Actions",
                  width: 360,
                  sortable: false,
                  renderCell: (p) => (
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Button size="small" variant="outlined" onClick={() => openEdit(p.row)}>
                        Edit
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => setApptStatus(p.row.id, "checked_in")}>
                        Check-in
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => setApptStatus(p.row.id, "completed")}>
                        Complete
                      </Button>
                      <Button size="small" color="error" variant="outlined" onClick={() => del(p.row.id)}>
                        Delete
                      </Button>
                    </Box>
                  ),
                },
              ]}
              loading={loading}
              disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
            />
          </Box>
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 900 }}>{editing ? "Edit Appointment" : "Add Appointment"}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2, mt: 1 }}>
            <TextField
              select
              label="Client"
              value={client_id || ""}
              onChange={(e) => setClientId(Number(e.target.value))}
            >
              {clients.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                </MenuItem>
              ))}
            </TextField>

            <TextField select label="Staff" value={staff_id || ""} onChange={(e) => setStaffId(Number(e.target.value))}>
              {staff.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Start"
              type="datetime-local"
              value={start_at}
              onChange={(e) => setStartAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="End"
              type="datetime-local"
              value={end_at}
              onChange={(e) => setEndAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              {statusOptions.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>

            <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography sx={{ fontWeight: 800, mb: 1 }}>Services</Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              <TextField
                select
                label="Add service"
                value={serviceIdInput || ""}
                onChange={(e) => setServiceIdInput(Number(e.target.value))}
                sx={{ minWidth: 320 }}
              >
                {services.map((sv) => (
                  <MenuItem key={sv.id} value={sv.id}>
                    {sv.name} — ${sv.price.toFixed(2)}
                  </MenuItem>
                ))}
              </TextField>
              <Button variant="outlined" onClick={addService} sx={{ fontWeight: 800 }}>
                Add
              </Button>
            </Box>

            <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
              {serviceIds.map((sid) => {
                const sv = services.find((x) => x.id === sid);
                return (
                  <Button
                    key={sid}
                    size="small"
                    variant="outlined"
                    onClick={() => removeService(sid)}
                    sx={{ borderRadius: 999 }}
                    title="Click to remove"
                  >
                    {sv ? `${sv.name}` : `Service ${sid}`} ✕
                  </Button>
                );
              })}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} sx={{ fontWeight: 800 }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}