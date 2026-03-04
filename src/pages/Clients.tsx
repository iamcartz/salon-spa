import { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { api } from "../lib/api";

type Row = {
  id: number;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  notes?: string;
  created_at?: string;
};

export default function Clients() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const cols: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", width: 90 },
      { field: "first_name", headerName: "First Name", width: 160 },
      { field: "last_name", headerName: "Last Name", width: 160 },
      { field: "phone", headerName: "Phone", width: 160 },
      { field: "email", headerName: "Email", width: 220 },
      { field: "notes", headerName: "Notes", flex: 1, minWidth: 220 },
    ],
    []
  );

  const fetchRows = async () => {
    setLoading(true);
    try {
      const r = await api.get("/clients"); // branch comes from X-Branch-Id header
      setRows(r.data.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFirst(""); setLast(""); setPhone(""); setEmail(""); setNotes("");
    setOpen(true);
  };

  const openEdit = (r: Row) => {
    setEditing(r);
    setFirst(r.first_name || "");
    setLast(r.last_name || "");
    setPhone(r.phone || "");
    setEmail(r.email || "");
    setNotes(r.notes || "");
    setOpen(true);
  };

  const save = async () => {
    const payload = { first_name, last_name, phone, email, notes };
    if (editing) await api.put(`/clients/${editing.id}`, payload);
    else await api.post("/clients", payload);
    setOpen(false);
    fetchRows();
  };

  const del = async (id: number) => {
    if (!confirm("Delete this client?")) return;
    await api.delete(`/clients/${id}`);
    fetchRows();
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>Clients</Typography>
          <Typography variant="body2" color="text.secondary">Branch-scoped records</Typography>
        </Box>
        <Button variant="contained" onClick={openCreate} sx={{ fontWeight: 800 }}>+ Add Client</Button>
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
                      <Button size="small" variant="outlined" onClick={() => openEdit(p.row)}>Edit</Button>
                      <Button size="small" color="error" variant="outlined" onClick={() => del(p.row.id)}>Delete</Button>
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
        <DialogTitle sx={{ fontWeight: 900 }}>{editing ? "Edit Client" : "Add Client"}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: "grid", gap: 2, mt: 1 }}>
            <TextField label="First Name" value={first_name} onChange={(e) => setFirst(e.target.value)} />
            <TextField label="Last Name" value={last_name} onChange={(e) => setLast(e.target.value)} />
            <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={3} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={save} sx={{ fontWeight: 800 }}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}