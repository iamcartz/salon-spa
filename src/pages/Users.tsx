// src/pages/Users.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { api } from "../lib/api";

type Branch = { id: number; name: string };

type Role = "admin" | "staff";
type Status = "active" | "disabled";

type Row = {
  id: number;
  branch_id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: Role;
  status: Status;
  created_at?: string;
};

export default function Users() {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [branches, setBranches] = useState<Branch[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const [err, setErr] = useState<string>("");

  const [branch_id, setBranchId] = useState<number>(0);
  const [first_name, setFirst] = useState("");
  const [last_name, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // optional on edit
  const [role, setRole] = useState<Role>("staff");
  const [status, setStatus] = useState<Status>("active");

  const cols: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", flex: 0.5, minWidth: 80 },
      { field: "branch_id", headerName: "Branch", flex: 0.6, minWidth: 110 },
      { field: "first_name", headerName: "First Name", flex: 1, minWidth: 140 },
      { field: "last_name", headerName: "Last Name", flex: 1, minWidth: 140 },
      { field: "email", headerName: "Email", flex: 1.5, minWidth: 220 },
      { field: "role", headerName: "Role", flex: 0.7, minWidth: 110 },
      { field: "status", headerName: "Status", flex: 0.8, minWidth: 120 },
    ],
    []
  );

  const fetchBranches = async () => {
    const r = await api.get("/branches");
    const bs = (r.data.rows || []) as Branch[];
    setBranches(bs);
    if (bs.length && branch_id === 0) setBranchId(bs[0].id);
  };

  const fetchRows = async () => {
    setLoading(true);
    try {
      const r = await api.get("/users");
      setRows(r.data.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await fetchBranches();
      await fetchRows();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setErr("");
    setEditing(null);
    setFirst("");
    setLast("");
    setEmail("");
    setPassword("");
    setRole("staff");
    setStatus("active");
    // keep branch selection
    if (branches.length && branch_id === 0) setBranchId(branches[0].id);
    setOpen(true);
  };

  const openEdit = (r: Row) => {
    setErr("");
    setEditing(r);
    setBranchId(r.branch_id);
    setFirst(r.first_name || "");
    setLast(r.last_name || "");
    setEmail(r.email || "");
    setPassword(""); // leave blank = keep existing password
    setRole(r.role);
    setStatus(r.status);
    setOpen(true);
  };

  const save = async () => {
    setErr("");

    const payload: any = {
      branch_id,
      first_name,
      last_name,
      email,
      role,
      status,
    };

    // password required only on create; optional on edit
    if (!editing) {
      if (!password) return setErr("Password is required for new users.");
      payload.password = password;
    } else {
      if (password) payload.password = password;
    }

    try {
      if (editing) await api.put(`/users/${editing.id}`, payload);
      else await api.post("/users", payload);

      setOpen(false);
      fetchRows();
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Save failed");
    }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this user?")) return;
    try {
      await api.delete(`/users/${id}`);
      fetchRows();
    } catch (e: any) {
      alert(e?.response?.data?.error || "Delete failed");
    }
  };

  const branchLabel = (id: number) => branches.find((b) => b.id === id)?.name || `Branch ${id}`;

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Users
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Admin-only: manage staff/admin accounts per branch
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate} sx={{ fontWeight: 800 }}>
          + Add User
        </Button>
      </Box>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Box sx={{ height: 560 }}>
            <DataGrid
              rows={rows.map((r) => ({ ...r, branch_id: r.branch_id }))}
              columns={[
                ...cols.map((c) =>
                  c.field === "branch_id"
                    ? {
                        ...c,
                        valueFormatter: (p: any) => branchLabel(Number(p.value)),
                      }
                    : c
                ),
                {
                  field: "actions",
                  headerName: "Actions",
                  minWidth: 210,
                  flex: 1,
                  sortable: false,
                  renderCell: (p) => (
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="outlined" onClick={() => openEdit(p.row)}>
                        Edit
                      </Button>
                      <Button size="small" color="error" variant="outlined" onClick={() => del(p.row.id)}>
                        Delete
                      </Button>
                    </Stack>
                  ),
                },
              ]}
              loading={loading}
              disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
              sx={{
                "& .MuiDataGrid-cell": { alignItems: "center" },
              }}
            />
          </Box>
        </CardContent>
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" fullScreen={fullScreen}>
        <DialogTitle sx={{ fontWeight: 900 }}>{editing ? "Edit User" : "Add User"}</DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {err ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {err}
            </Alert>
          ) : null}

          <Box sx={{ display: "grid", gap: 2, mt: 1 }}>
            <TextField
              select
              label="Branch"
              value={branch_id || ""}
              onChange={(e) => setBranchId(Number(e.target.value))}
            >
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>
                  {b.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField label="First Name" value={first_name} onChange={(e) => setFirst(e.target.value)} />
            <TextField label="Last Name" value={last_name} onChange={(e) => setLast(e.target.value)} />
            <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

            <TextField
              label={editing ? "New Password (optional)" : "Password"}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              helperText={editing ? "Leave blank to keep current password" : ""}
            />

            <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <MenuItem value="staff">staff</MenuItem>
              <MenuItem value="admin">admin</MenuItem>
            </TextField>

            <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="disabled">disabled</MenuItem>
            </TextField>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)} fullWidth={fullScreen}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} fullWidth={fullScreen} sx={{ fontWeight: 800 }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}