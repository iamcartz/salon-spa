// src/pages/Commissions.tsx
import { useEffect, useMemo, useState } from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { api } from "../lib/api";

type Row = {
  id: number;
  staff_id: number;
  staff_name: string;
  appointment_id: number;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  created_at: string;
};

export default function Commissions() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const cols: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "ID", width: 90 },
      { field: "staff_name", headerName: "Staff", width: 220 },
      { field: "appointment_id", headerName: "Appt ID", width: 120, type: "number" },
      { field: "gross_amount", headerName: "Gross", width: 130, type: "number" },
      {
        field: "commission_rate",
        headerName: "Rate %",
        width: 120,
        type: "number",
        valueFormatter: (p: any) => `${Number(p.value || 0).toFixed(2)}%`,
      },
      { field: "commission_amount", headerName: "Commission", width: 140, type: "number" },
      { field: "created_at", headerName: "Created", width: 200 },
    ],
    []
  );

  const fetchRows = async () => {
    setLoading(true);
    try {
      const r = await api.get("/commissions");
      setRows(r.data.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Commissions
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Read-only list per branch (we’ll calculate these after appointment completion)
        </Typography>
      </Box>

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Box sx={{ height: 560 }}>
            <DataGrid
              rows={rows}
              columns={cols}
              loading={loading}
              disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50]}
              initialState={{ pagination: { paginationModel: { pageSize: 10, page: 0 } } }}
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}