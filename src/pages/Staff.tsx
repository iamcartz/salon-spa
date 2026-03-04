// src/pages/Staff.tsx
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
  TextField,
  Typography,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  FormHelperText,
} from "@mui/material";
import Grid from "@mui/material/GridLegacy";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import { api } from "../lib/api";

type Branch = {
  id: number;
  name: string;
  status?: "active" | "inactive" | string;
};

type Row = {
  id: number;
  branch_id?: number;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  specialty?: string;
  commission_rate: number;
  status: "active" | "inactive";
};

export default function Staff() {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const [err, setErr] = useState<string>("");

  const [branch_id, setBranchId] = useState<number>(() => Number(localStorage.getItem("branch_id") || 0));
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [commission_rate, setCommissionRate] = useState<number>(0);
  const [status, setStatus] = useState<Row["status"]>("active");

  const cols: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", width: 70 },

      { field: "first_name", headerName: "First Name", flex: 1, minWidth: 120 },
      { field: "last_name", headerName: "Last Name", flex: 1, minWidth: 120 },

      { field: "phone", headerName: "Phone", flex: 1, minWidth: 130 },
      { field: "email", headerName: "Email", flex: 1.3, minWidth: 180 },

      { field: "specialty", headerName: "Specialty", flex: 1, minWidth: 130 },

      {
        field: "commission_rate",
        headerName: "Commission %",
        flex: 0.7,
        minWidth: 120,
        type: "number",
        valueFormatter: (p: any) => `${Number(p.value || 0).toFixed(2)}%`,
      },

      { field: "status", headerName: "Status", flex: 0.7, minWidth: 100 },
    ],
    []
  )

  const fetchBranches = async () => {
    setBranchesLoading(true);
    try {
      const r = await api.get("/branches"); // { ok:true, rows:[...] }
      const bs: Branch[] = r.data?.rows || [];
      setBranches(bs);

      // Default branch if not set
      const saved = Number(localStorage.getItem("branch_id") || 0);
      if (!saved && bs.length) {
        localStorage.setItem("branch_id", String(bs[0].id));
        setBranchId(bs[0].id);
      }
    } finally {
      setBranchesLoading(false);
    }
  };

  const fetchRows = async () => {
    setLoading(true);
    try {
      const r = await api.get("/staff");
      setRows(r.data.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
    fetchRows();
  }, []);

  const openCreate = () => {
    setErr("");
    setEditing(null);

    // default branch selection
    const saved = Number(localStorage.getItem("branch_id") || 0);
    const fallback = branches.length ? branches[0].id : 0;
    setBranchId(saved || fallback);

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
    setErr("");
    setEditing(r);

    const saved = Number(localStorage.getItem("branch_id") || 0);
    // If row has branch_id use it, else use saved, else fallback
    const fallback = branches.length ? branches[0].id : 0;
    setBranchId(Number(r.branch_id || saved || fallback));

    setFirst(r.first_name || "");
    setLast(r.last_name || "");
    setPhone(r.phone || "");
    setEmail(r.email || "");
    setSpecialty(r.specialty || "");
    setCommissionRate(Number(r.commission_rate || 0));
    setStatus(r.status || "active");
    setOpen(true);
  };

  const save = async () => {
    setErr("");

    if (!branch_id) {
      setErr("Please select a branch.");
      return;
    }
    if (!first_name.trim() || !last_name.trim()) {
      setErr("First Name and Last Name are required.");
      return;
    }

    const payload = {
      branch_id: Number(branch_id),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      specialty: specialty.trim(),
      commission_rate: Number(commission_rate || 0),
      status,
    };

    try {
      if (editing) {
        await api.put(`/staff/${editing.id}`, payload);
      } else {
        await api.post("/staff", payload);
      }

      setOpen(false);
      fetchRows();
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        (typeof e?.response?.data === "string" ? e.response.data : "") ||
        e?.message ||
        "Request failed";
      setErr(msg);
    }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this staff?")) return;
    await api.delete(`/staff/${id}`);
    fetchRows();
  };

  const activeBranches = branches.filter((b) => (b.status ?? "active") === "active");

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Staff
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Staff per branch (base commission rate)
          </Typography>
        </Box>

        <Button variant="contained" onClick={openCreate} sx={{ fontWeight: 800 }}>
          + Add Staff
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

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 900 }}>{editing ? "Edit Staff" : "Add Staff"}</DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {err ? (
            <Box
              sx={{
                mb: 2,
                p: 1.5,
                borderRadius: 2,
                bgcolor: "rgba(244,67,54,0.08)",
                color: "error.main",
                fontWeight: 700,
              }}
            >
              {err}
            </Box>
          ) : null}

          <Box sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth required disabled={branchesLoading || activeBranches.length === 0}>
                  <InputLabel id="branch-label">Branch</InputLabel>
                  <Select
                    labelId="branch-label"
                    label="Branch"
                    value={branch_id || ""}
                    onChange={(e) => setBranchId(Number(e.target.value))}
                  >
                    {activeBranches.map((b) => (
                      <MenuItem key={b.id} value={b.id}>
                        {b.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {activeBranches.length
                      ? "Select which branch this staff belongs to"
                      : "No branches found. Add branches first."}
                  </FormHelperText>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="First Name" value={first_name} onChange={(e) => setFirst(e.target.value)} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Last Name" value={last_name} onChange={(e) => setLast(e.target.value)} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Grid>

              <Grid item xs={12}>
                <TextField fullWidth label="Specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Commission %"
                  type="number"
                  value={commission_rate}
                  onChange={(e) => setCommissionRate(Number(e.target.value))}
                  inputProps={{ min: 0, max: 100, step: "0.01" }}
                  helperText="Base commission rate used if service commission is blank"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField select fullWidth label="Status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                  <MenuItem value="active">active</MenuItem>
                  <MenuItem value="inactive">inactive</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setOpen(false)} fullWidth={fullScreen} variant="text">
            Cancel
          </Button>
          <Button onClick={save} fullWidth={fullScreen} variant="contained" disabled={!activeBranches.length}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}