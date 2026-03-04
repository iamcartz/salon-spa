// src/pages/Services.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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

type Category = "massage" | "hair" | "nails" | "facial" | "other";
type Status = "active" | "inactive";

type Row = {
  id: number;
  category: Category;
  name: string;
  duration_mins: number;
  price: number;
  commission_rate: number | null; // null = use staff base rate
  status: Status;
};

const categories: Category[] = ["massage", "hair", "nails", "facial", "other"];

function money(n: any) {
  const x = Number(n ?? 0);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

function pct(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return `${x.toFixed(2)}%`;
}

function catLabel(c: Category) {
  switch (c) {
    case "massage":
      return "Massage";
    case "hair":
      return "Hair";
    case "nails":
      return "Nails";
    case "facial":
      return "Facial";
    default:
      return "Other";
  }
}

function catChipColor(c: Category): "default" | "primary" | "secondary" | "success" | "warning" | "info" {
  switch (c) {
    case "massage":
      return "info";
    case "hair":
      return "secondary";
    case "nails":
      return "warning";
    case "facial":
      return "success";
    default:
      return "default";
  }
}

export default function Services() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // Optional table filters (client-side)
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<Category | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const [category, setCategory] = useState<Category>("other");
  const [name, setName] = useState("");
  const [duration_mins, setDuration] = useState<number>(60);
  const [price, setPrice] = useState<number>(0);
  const [commission_rate, setCommissionRate] = useState<string>(""); // allow blank
  const [status, setStatus] = useState<Status>("active");

  const cols: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", width: 80 },
      {
        field: "category",
        headerName: "Category",
        flex: 1,
        minWidth: 140,
        sortable: true,
        renderCell: (p) => (
          <Chip
            size="small"
            label={catLabel(p.value as Category)}
            color={catChipColor(p.value as Category)}
            variant={p.value === "other" ? "outlined" : "filled"}
            sx={{ fontWeight: 700 }}
          />
        ),
      },
      { field: "name", headerName: "Service", flex: 2, minWidth: 220 },
      {
        field: "duration_mins",
        headerName: "Duration",
        flex: 1,
        minWidth: 120,
        type: "number",
        valueFormatter: (p: any) => `${Number(p.value ?? 0)} mins`,
      },
      {
        field: "price",
        headerName: "Price",
        flex: 1,
        minWidth: 120,
        type: "number",
        valueFormatter: (p: any) => `₱${money(p.value)}`,
      },
      {
        field: "commission_rate",
        headerName: "Commission",
        flex: 1,
        minWidth: 160,
        sortable: false,
        renderCell: (p) => {
          const v = p.value;
          // null = use staff commission rate
          if (v === null || v === undefined || v === "") {
            return <Chip size="small" label="Use staff rate" variant="outlined" sx={{ fontWeight: 700 }} />;
          }
          const n = Number(v);
          if (!Number.isFinite(n)) {
            return <Chip size="small" label="Use staff rate" variant="outlined" sx={{ fontWeight: 700 }} />;
          }
          return <Chip size="small" label={pct(n)} color="primary" sx={{ fontWeight: 800 }} />;
        },
      },
      {
        field: "status",
        headerName: "Status",
        flex: 1,
        minWidth: 120,
        renderCell: (p) => (
          <Chip
            size="small"
            label={String(p.value)}
            color={p.value === "active" ? "success" : "default"}
            variant={p.value === "active" ? "filled" : "outlined"}
            sx={{ fontWeight: 800 }}
          />
        ),
      },
    ],
    []
  );

  const fetchRows = async () => {
    setLoading(true);
    try {
      const r = await api.get("/services");

      // ✅ IMPORTANT: normalize API (MySQL often returns decimals as strings)
      const normalized: Row[] = (r.data.rows || []).map((x: any) => ({
        id: Number(x.id),
        category: (x.category || "other") as Category,
        name: String(x.name || ""),
        duration_mins: Number(x.duration_mins ?? 0),
        price: Number(x.price ?? 0),
        commission_rate:
          x.commission_rate === null || x.commission_rate === undefined || x.commission_rate === ""
            ? null
            : Number(x.commission_rate),
        status: (x.status || "active") as Status,
      }));

      setRows(normalized);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const filteredRows = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (catFilter !== "all" && r.category !== catFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!qq) return true;
      return (
        String(r.name || "").toLowerCase().includes(qq) ||
        String(r.category || "").toLowerCase().includes(qq) ||
        String(r.id).includes(qq)
      );
    });
  }, [rows, q, catFilter, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setCategory("other");
    setName("");
    setDuration(60);
    setPrice(0);
    setCommissionRate("");
    setStatus("active");
    setOpen(true);
  };

  const openEdit = (r: Row) => {
    setEditing(r);
    setCategory(r.category);
    setName(r.name || "");
    setDuration(Number(r.duration_mins || 60));
    setPrice(Number(r.price || 0));
    setCommissionRate(r.commission_rate === null ? "" : String(r.commission_rate));
    setStatus(r.status || "active");
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      category,
      name,
      duration_mins: Number(duration_mins || 0),
      price: Number(price || 0),
      commission_rate: commission_rate === "" ? null : Number(commission_rate),
      status,
    };

    if (editing) await api.put(`/services/${editing.id}`, payload);
    else await api.post("/services", payload);

    setOpen(false);
    fetchRows();
  };

  const del = async (id: number) => {
    if (!confirm("Delete this service?")) return;
    await api.delete(`/services/${id}`);
    fetchRows();
  };

  return (
    <Box>
      {/* Header */}
      <Stack
        direction={isMobile ? "column" : "row"}
        spacing={isMobile ? 1.5 : 2}
        sx={{ alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Services
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Branch-scoped services (optional per-service commission override)
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
          <Button variant="contained" onClick={openCreate} sx={{ fontWeight: 800 }}>
            + Add Service
          </Button>
        </Stack>
      </Stack>

      {/* Filters */}
      <Card sx={{ borderRadius: 4, mb: 2 }}>
        <CardContent>
          <Stack
            direction={isMobile ? "column" : "row"}
            spacing={2}
            sx={{ alignItems: isMobile ? "stretch" : "center" }}
          >
            <TextField
              label="Search"
              placeholder="Search by service name or category…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              fullWidth={isMobile}
            />

            <TextField
              select
              label="Category"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value as any)}
              sx={{ minWidth: 180 }}
              fullWidth={isMobile}
            >
              <MenuItem value="all">All</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c} value={c}>
                  {catLabel(c)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              sx={{ minWidth: 160 }}
              fullWidth={isMobile}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="inactive">inactive</MenuItem>
            </TextField>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Chip
              label={`Total: ${filteredRows.length}`}
              variant="outlined"
              sx={{ fontWeight: 800 }}
            />
            <Chip
              label={`Active: ${filteredRows.filter((r) => r.status === "active").length}`}
              color="success"
              variant="outlined"
              sx={{ fontWeight: 800 }}
            />
            <Chip
              label={`With commission: ${filteredRows.filter((r) => r.commission_rate !== null).length}`}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 800 }}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Table */}
      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Box sx={{ height: 560 }}>
            <DataGrid
              rows={filteredRows}
              columns={[
                ...cols,
                {
                  field: "actions",
                  headerName: "Actions",
                  width: isMobile ? 170 : 220,
                  sortable: false,
                  renderCell: (p) => (
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
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
              // ✅ Make it feel better on small screens
              density={isMobile ? "compact" : "standard"}
              sx={{
                "& .MuiDataGrid-columnHeaders": { borderRadius: 2 },
                "& .MuiDataGrid-cell": { outline: "none" },
              }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Modal */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900 }}>{editing ? "Edit Service" : "Add Service"}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: "grid", gap: 2, mt: 1 }}>
            <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value as any)}>
              {categories.map((c) => (
                <MenuItem key={c} value={c}>
                  {catLabel(c)}
                </MenuItem>
              ))}
            </TextField>

            <TextField label="Service Name" value={name} onChange={(e) => setName(e.target.value)} />

            <TextField
              label="Duration (mins)"
              type="number"
              value={duration_mins}
              onChange={(e) => setDuration(Number(e.target.value))}
              inputProps={{ min: 0 }}
            />

            <TextField
              label="Price"
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              inputProps={{ min: 0, step: "0.01" }}
            />

            <TextField
              label="Commission % (optional)"
              type="number"
              value={commission_rate}
              onChange={(e) => setCommissionRate(e.target.value)}
              inputProps={{ min: 0, max: 100, step: "0.01" }}
              helperText="Leave blank to use staff commission rate"
            />

            <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="inactive">inactive</MenuItem>
            </TextField>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setOpen(false)} fullWidth={isMobile}>
            Cancel
          </Button>
          <Button variant="contained" onClick={save} sx={{ fontWeight: 800 }} fullWidth={isMobile}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}