// src/pages/Payments.tsx
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

type Appt = { id: number; client_name: string; staff_name: string; status: string; start_at: string; end_at: string };
type Row = {
  id: number;
  appointment_id: number;
  amount: number;
  method: "cash" | "card" | "bank";
  status: "paid" | "refunded" | "pending";
  paid_at: string;
  created_at: string;
  client_name?: string;
  staff_name?: string;
};

export default function Payments() {
  const [rows, setRows] = useState<Row[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const [appointment_id, setAppointmentId] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<Row["method"]>("cash");
  const [status, setStatus] = useState<Row["status"]>("paid");
  const [paid_at, setPaidAt] = useState<string>("");

  const cols: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", width: 90 },
      { field: "appointment_id", headerName: "Appt ID", width: 110, type: "number" },
      { field: "client_name", headerName: "Client", width: 220 },
      { field: "staff_name", headerName: "Staff", width: 220 },
      { field: "amount", headerName: "Amount", width: 120, type: "number" },
      { field: "method", headerName: "Method", width: 120 },
      { field: "status", headerName: "Status", width: 120 },
      { field: "paid_at", headerName: "Paid At", width: 190 },
      { field: "created_at", headerName: "Created", width: 190 },
    ],
    []
  );

  const fetchRows = async () => {
    setLoading(true);
    try {
      const r = await api.get("/payments");
      setRows(r.data.rows || []);
    } finally {
      setLoading(false);
    }
  };

  const fetchAppts = async () => {
    const r = await api.get("/appointments");
    setAppts((r.data.rows || []).map((x: any) => ({
      id: x.id,
      client_name: x.client_name,
      staff_name: x.staff_name,
      status: x.status,
      start_at: x.start_at,
      end_at: x.end_at
    })));
  };

  useEffect(() => {
    (async () => {
      await fetchAppts();
      await fetchRows();
    })();
  }, []);

  const openCreate = () => {
    setEditing(null);
    const defaultAppt = appts[0]?.id || 0;
    setAppointmentId(defaultAppt);
    setAmount(0);
    setMethod("cash");
    setStatus("paid");
    setPaidAt(new Date().toISOString().slice(0, 16));
    setOpen(true);
  };

  const openEdit = (r: Row) => {
    setEditing(r);
    setAppointmentId(r.appointment_id);
    setAmount(Number(r.amount || 0));
    setMethod(r.method);
    setStatus(r.status);
    setPaidAt((r.paid_at || "").replace(" ", "T").slice(0, 16));
    setOpen(true);
  };

  const save = async () => {
    if (!appointment_id) return alert("Appointment is required");
    if (!paid_at) return alert("Paid at is required");

    const payload = {
      appointment_id,
      amount: Number(amount || 0),
      method,
      status,
      paid_at: paid_at.replace("T", " ") + ":00",
    };

    if (editing) await api.put(`/payments/${editing.id}`, payload);
    else await api.post("/payments", payload);

    setOpen(false);
    fetchRows();
  };

  const del = async (id: number) => {
    if (!confirm("Delete this payment?")) return;
    await api.delete(`/payments/${id}`);
    fetchRows();
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Payments
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Branch-scoped payments (linked to appointment)
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate} sx={{ fontWeight: 800 }}>
          + Add Payment
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
                  field: "actions",
                  headerName: "Actions",
                  width: 220,
                  sortable: false,
                  renderCell: (p) => (
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => openEdit(p.row)}>
                        Edit
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

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>{editing ? "Edit Payment" : "Add Payment"}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: "grid", gap: 2, mt: 1 }}>
            <TextField
              select
              label="Appointment"
              value={appointment_id || ""}
              onChange={(e) => setAppointmentId(Number(e.target.value))}
            >
              {appts.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  #{a.id} — {a.client_name} / {a.staff_name} ({a.status})
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              inputProps={{ min: 0, step: "0.01" }}
            />

            <TextField select label="Method" value={method} onChange={(e) => setMethod(e.target.value as any)}>
              <MenuItem value="cash">cash</MenuItem>
              <MenuItem value="card">card</MenuItem>
              <MenuItem value="bank">bank</MenuItem>
            </TextField>

            <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <MenuItem value="paid">paid</MenuItem>
              <MenuItem value="pending">pending</MenuItem>
              <MenuItem value="refunded">refunded</MenuItem>
            </TextField>

            <TextField
              label="Paid At"
              type="datetime-local"
              value={paid_at}
              onChange={(e) => setPaidAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
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