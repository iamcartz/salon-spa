// src/pages/Inventory.tsx
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
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { api } from "../lib/api";

type Row = {
  id: number;
  sku?: string | null;
  name: string;
  unit: string;
  qty_on_hand: any;
  reorder_level: any;
  cost: any;
  price: any;
  status: "active" | "inactive";
  created_at?: string | null;
};

const UNITS = ["pcs", "bottle", "ml", "g", "box"];

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(v: any) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

function isLowStock(r: Row) {
  return n(r.qty_on_hand) <= n(r.reorder_level) && n(r.reorder_level) > 0;
}

function StatusChip({ status }: { status: Row["status"] }) {
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

function StockChip({ row }: { row: Row }) {
  if (!isLowStock(row)) return null;
  return (
    <Chip
      size="small"
      icon={<WarningAmberIcon fontSize="small" />}
      label="Low stock"
      color="warning"
      variant="filled"
      sx={{ fontWeight: 800 }}
    />
  );
}

export default function Inventory() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const dialogFullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Row["status"]>("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // dialog
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  // form
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [qty_on_hand, setQty] = useState<number>(0);
  const [reorder_level, setReorder] = useState<number>(0);
  const [cost, setCost] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [status, setStatus] = useState<Row["status"]>("active");

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
      const r = await api.get("/inventory");
      setRows((r.data?.rows || []) as Row[]);
    } catch (e: any) {
      notify("error", e?.response?.data?.error || "Failed to load inventory");
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
        String(r.sku || "").toLowerCase().includes(qq) ||
        String(r.name || "").toLowerCase().includes(qq) ||
        String(r.unit || "").toLowerCase().includes(qq);

      const matchesStatus = statusFilter === "all" ? true : r.status === statusFilter;
      const matchesLow = lowStockOnly ? isLowStock(r) : true;

      return matchesQ && matchesStatus && matchesLow;
    });
  }, [rows, q, statusFilter, lowStockOnly]);

  const totals = useMemo(() => {
    const active = rows.filter((r) => r.status === "active");
    const low = active.filter((r) => isLowStock(r));
    return { total: rows.length, active: active.length, low: low.length };
  }, [rows]);

  const openCreate = () => {
    setEditing(null);
    setSku("");
    setName("");
    setUnit("pcs");
    setQty(0);
    setReorder(0);
    setCost(0);
    setPrice(0);
    setStatus("active");
    setOpen(true);
  };

  const openEdit = (r: Row) => {
    setEditing(r);
    setSku((r.sku as string) || "");
    setName(r.name || "");
    setUnit(r.unit || "pcs");
    setQty(n(r.qty_on_hand));
    setReorder(n(r.reorder_level));
    setCost(n(r.cost));
    setPrice(n(r.price));
    setStatus(r.status || "active");
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      sku: sku.trim(),
      name: name.trim(),
      unit,
      qty_on_hand: Number(qty_on_hand || 0),
      reorder_level: Number(reorder_level || 0),
      cost: Number(cost || 0),
      price: Number(price || 0),
      status,
    };

    if (!payload.name) {
      notify("error", "Item name is required");
      return;
    }

    try {
      if (editing) await api.put(`/inventory/${editing.id}`, payload);
      else await api.post("/inventory", payload);

      notify("success", editing ? "Item updated" : "Item created");
      setOpen(false);
      fetchRows();
    } catch (e: any) {
      notify("error", e?.response?.data?.error || "Save failed");
    }
  };

  const del = async (id: number) => {
    if (!confirm("Delete this inventory item?")) return;
    try {
      await api.delete(`/inventory/${id}`);
      notify("success", "Item deleted");
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
        <Stack
          direction="row"
          spacing={1}
          justifyContent="flex-end"
          sx={{ width: "100%", pr: 1, "& .MuiButton-root": { flexShrink: 0, minWidth: 86 } }}
        >
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
      { field: "id", headerName: "ID", flex: 0.5, minWidth: 70 },
      { field: "sku", headerName: "SKU", flex: 1, minWidth: 140 },

      {
        field: "name",
        headerName: "Item",
        flex: 1.8,
        minWidth: 260,
        renderCell: (p: GridRenderCellParams<any, Row>) => (
          <Stack spacing={0.4} sx={{ py: 0.6, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }} noWrap>
              {p.row.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
              Unit: {p.row.unit}
            </Typography>
            <StockChip row={p.row} />
          </Stack>
        ),
      },

      {
        field: "qty_on_hand",
        headerName: "On hand",
        flex: 0.9,
        minWidth: 120,
        align: "right",
        headerAlign: "right",
        renderCell: (p: GridRenderCellParams<any, Row>) => <>{money(p.row.qty_on_hand)}</>,
      },

      {
        field: "reorder_level",
        headerName: "Reorder",
        flex: 0.9,
        minWidth: 120,
        align: "right",
        headerAlign: "right",
        renderCell: (p: GridRenderCellParams<any, Row>) => <>{money(p.row.reorder_level)}</>,
      },

      {
        field: "cost",
        headerName: "Cost",
        flex: 0.9,
        minWidth: 120,
        align: "right",
        headerAlign: "right",
        renderCell: (p: GridRenderCellParams<any, Row>) => <>{money(p.row.cost)}</>,
      },

      {
        field: "price",
        headerName: "Price",
        flex: 0.9,
        minWidth: 120,
        align: "right",
        headerAlign: "right",
        renderCell: (p: GridRenderCellParams<any, Row>) => <>{money(p.row.price)}</>,
      },

      {
        field: "status",
        headerName: "Status",
        flex: 0.9,
        minWidth: 120,
        renderCell: (p: GridRenderCellParams<any, Row>) => <StatusChip status={(p.value || "active") as any} />,
      },

      {
        field: "actions",
        headerName: "",
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        flex: 1.2,
        minWidth: 210,
        align: "right",
        headerAlign: "right",
        renderCell: (p: GridRenderCellParams<any, Row>) => <ActionsCell row={p.row} />,
      },
    ],
    [isMobile]
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
            Inventory
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track on-hand, reorder, cost, and price per branch
          </Typography>
        </Box>

        <Button variant="contained" onClick={openCreate} sx={{ fontWeight: 900 }}>
          + Add Item
        </Button>
      </Stack>

      {/* Summary chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Chip label={`Total: ${totals.total}`} sx={{ fontWeight: 800 }} />
        <Chip label={`Active: ${totals.active}`} color="success" variant="outlined" sx={{ fontWeight: 800 }} />
        <Chip
          label={`Low stock: ${totals.low}`}
          color={totals.low > 0 ? "warning" : "default"}
          variant={totals.low > 0 ? "filled" : "outlined"}
          sx={{ fontWeight: 800 }}
        />
      </Stack>

      {/* Filters */}
      <Card sx={{ borderRadius: 4, mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
            <TextField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search SKU / name / unit"
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
              sx={{ minWidth: { xs: "100%", sm: 170 } }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="inactive">inactive</MenuItem>
            </TextField>

            <Chip
              clickable
              onClick={() => setLowStockOnly((v) => !v)}
              icon={<WarningAmberIcon fontSize="small" />}
              label={lowStockOnly ? "Low stock only" : "Show all stock"}
              color={lowStockOnly ? "warning" : "default"}
              variant={lowStockOnly ? "filled" : "outlined"}
              sx={{ fontWeight: 900, justifyContent: "flex-start", minWidth: { xs: "100%", sm: 190 } }}
            />

            <Box sx={{ flex: 1 }} />

            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
              {filtered.length} item{filtered.length === 1 ? "" : "s"}
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {/* Table */}
      <Card sx={{ borderRadius: 4 }}>
        <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
          <DataGrid
            autoHeight
            rows={filtered}
            columns={cols}
            loading={loading}
            disableRowSelectionOnClick
            disableColumnMenu
            density="standard"
            getRowHeight={() => "auto"} // ✅ fixes Item text clipping
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
            sx={{
              border: 0,
              "& .MuiDataGrid-cell": {
                outline: "none",
                py: 1,
                alignItems: "flex-start",
              },
              "& .MuiDataGrid-row": { maxHeight: "none !important" },
              "& .MuiDataGrid-virtualScroller": { overflowX: "auto" },
            }}
            localeText={{
              noRowsLabel: "No inventory items yet. Click “Add Item” to create your first record.",
            }}
          />
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" fullScreen={dialogFullScreen}>
        <DialogTitle sx={{ fontWeight: 900 }}>{editing ? "Edit Item" : "Add Item"}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="SKU (optional)" value={sku} onChange={(e) => setSku(e.target.value)} />
            <TextField label="Item Name" value={name} onChange={(e) => setName(e.target.value)} />

            <TextField select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {UNITS.map((u) => (
                <MenuItem key={u} value={u}>
                  {u}
                </MenuItem>
              ))}
            </TextField>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Qty On Hand"
                type="number"
                value={qty_on_hand}
                onChange={(e) => setQty(Number(e.target.value))}
                inputProps={{ step: "0.01" }}
                fullWidth
              />
              <TextField
                label="Reorder Level"
                type="number"
                value={reorder_level}
                onChange={(e) => setReorder(Number(e.target.value))}
                inputProps={{ step: "0.01" }}
                fullWidth
              />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Cost"
                type="number"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                inputProps={{ min: 0, step: "0.01" }}
                fullWidth
              />
              <TextField
                label="Price"
                type="number"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                inputProps={{ min: 0, step: "0.01" }}
                fullWidth
              />
            </Stack>

            <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="inactive">inactive</MenuItem>
            </TextField>

            {isLowStock({
              id: 0,
              name,
              unit,
              qty_on_hand,
              reorder_level,
              cost,
              price,
              status,
              sku,
            } as Row) && (
              <Alert severity="warning" variant="outlined">
                This item is currently <b>low stock</b> (on-hand ≤ reorder level).
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