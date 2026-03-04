// src/pages/Inventory.tsx
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

type Row = {
  id: number;
  sku?: string;
  name: string;
  unit: string;
  qty_on_hand: number;
  reorder_level: number;
  cost: number;
  price: number;
  status: "active" | "inactive";
};

export default function Inventory() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [qty_on_hand, setQty] = useState<number>(0);
  const [reorder_level, setReorder] = useState<number>(0);
  const [cost, setCost] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [status, setStatus] = useState<Row["status"]>("active");

  const cols: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID",flex: 1, minWidth: 50 },
      { field: "sku", headerName: "SKU", flex: 1, minWidth: 110 },
      { field: "name", headerName: "Item", flex: 1, minWidth: 220 },
      { field: "unit", headerName: "Unit", flex: 1, minWidth: 60 },
      { field: "qty_on_hand", headerName: "On Hand", flex: 1, minWidth: 120, type: "number" },
      { field: "reorder_level", headerName: "Reorder", flex: 1, minWidth: 120, type: "number" },
      { field: "cost", headerName: "Cost", flex: 1, minWidth: 120, type: "number" },
      { field: "price", headerName: "Price", flex: 1, minWidth: 120, type: "number" },
      { field: "status", headerName: "Status", flex: 1, minWidth: 120 },
    ],
    []
  );

  const fetchRows = async () => {
    setLoading(true);
    try {
      const r = await api.get("/inventory");
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
    setSku(r.sku || "");
    setName(r.name || "");
    setUnit(r.unit || "pcs");
    setQty(Number(r.qty_on_hand || 0));
    setReorder(Number(r.reorder_level || 0));
    setCost(Number(r.cost || 0));
    setPrice(Number(r.price || 0));
    setStatus(r.status || "active");
    setOpen(true);
  };

  const save = async () => {
    const payload = {
      sku,
      name,
      unit,
      qty_on_hand: Number(qty_on_hand || 0),
      reorder_level: Number(reorder_level || 0),
      cost: Number(cost || 0),
      price: Number(price || 0),
      status,
    };

    if (editing) await api.put(`/inventory/${editing.id}`, payload);
    else await api.post("/inventory", payload);

    setOpen(false);
    fetchRows();
  };

  const del = async (id: number) => {
    if (!confirm("Delete this inventory item?")) return;
    await api.delete(`/inventory/${id}`);
    fetchRows();
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Inventory
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Stock per branch (track on-hand + reorder)
          </Typography>
        </Box>
        <Button variant="contained" onClick={openCreate} sx={{ fontWeight: 800 }}>
          + Add Item
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
        <DialogTitle sx={{ fontWeight: 900 }}>{editing ? "Edit Item" : "Add Item"}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: "grid", gap: 2, mt: 1 }}>
            <TextField label="SKU (optional)" value={sku} onChange={(e) => setSku(e.target.value)} />
            <TextField label="Item Name" value={name} onChange={(e) => setName(e.target.value)} />

            <TextField select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {["pcs", "bottle", "ml", "g", "box"].map((u) => (
                <MenuItem key={u} value={u}>
                  {u}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Qty On Hand"
              type="number"
              value={qty_on_hand}
              onChange={(e) => setQty(Number(e.target.value))}
              inputProps={{ step: "0.01" }}
            />

            <TextField
              label="Reorder Level"
              type="number"
              value={reorder_level}
              onChange={(e) => setReorder(Number(e.target.value))}
              inputProps={{ step: "0.01" }}
            />

            <TextField
              label="Cost"
              type="number"
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
              inputProps={{ min: 0, step: "0.01" }}
            />

            <TextField
              label="Price"
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              inputProps={{ min: 0, step: "0.01" }}
            />

            <TextField select label="Status" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="inactive">inactive</MenuItem>
            </TextField>
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