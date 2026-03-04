// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  TextField,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { api } from "../lib/api";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

function money(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function int(n: number) {
  return n.toLocaleString();
}
function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDaysYMD(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card sx={{ borderRadius: 4 }}>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box>
            <Typography variant="body2" color="text.secondary">{title}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5 }}>{value}</Typography>
            {sub ? <Typography variant="caption" color="text.secondary">{sub}</Typography> : null}
          </Box>
        </Box>
        <Box sx={{ mt: 2, height: 40, bgcolor: "rgba(15,118,110,0.06)", borderRadius: 2 }} />
      </CardContent>
    </Card>
  );
}

type DashStats = {
  sales: number;
  appointments: number;
  completed: number;
  commissions: number;
  new_clients: number;
};

type DailyRow = {
  day: string;        // YYYY-MM-DD
  total: number;      // COUNT(*)
  completed: number;  // completed count
};

type StatusRow = {
  status: string;
  cnt: number;
};

export default function Dashboard() {
  const defaultTo = todayYMD();
  const defaultFrom = addDaysYMD(defaultTo, -6);

  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [stats, setStats] = useState<DashStats>({
    sales: 0,
    appointments: 0,
    completed: 0,
    commissions: 0,
    new_clients: 0,
  });

  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [status, setStatus] = useState<StatusRow[]>([]);

  const canApply = useMemo(() => !!from && !!to && from <= to, [from, to]);

  const load = async (f = from, t = to) => {
    setLoading(true);
    setErr("");
    try {
      const r = await api.get("/dashboard", { params: { from: f, to: t } });
      setStats(r.data?.stats ?? stats);
      setDaily((r.data?.charts?.daily_appointments ?? []).map((x: any) => ({
        day: String(x.day),
        total: Number(x.total || 0),
        completed: Number(x.completed || 0),
      })));
      setStatus((r.data?.charts?.status_breakdown ?? []).map((x: any) => ({
        status: String(x.status),
        cnt: Number(x.cnt || 0),
      })));
    } catch (e: any) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(defaultFrom, defaultTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // We are NOT specifying colors globally; using chart defaults.
  // For Pie, recharts needs Cell fills; if you want "no specific colors", we can remove Cells,
  // but it will render as one color. This is a practical compromise:
  const pieFills = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"];

  return (
    <Box>
      {/* Filters */}
      <Card sx={{ borderRadius: 4, mb: 2 }}>
        <CardContent>
          <Box
            sx={{
              display: "flex",
              gap: 2,
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
              <TextField
                label="Date From"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
              <TextField
                label="Date To"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                size="small"
              />

              <Button
                variant="contained"
                onClick={() => load()}
                disabled={!canApply || loading}
                sx={{ fontWeight: 800 }}
              >
                Apply
              </Button>

              <Button
                variant="text"
                onClick={() => {
                  setFrom(defaultFrom);
                  setTo(defaultTo);
                  load(defaultFrom, defaultTo);
                }}
                disabled={loading}
              >
                Reset
              </Button>
            </Box>

            <Typography variant="body2" color="text.secondary">
              {loading ? "Loading..." : err ? err : `Showing ${from} to ${to}`}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* KPIs */}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Sales" value={`₱${money(stats.sales)}`} sub="Completed appointments" />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Appointments" value={int(stats.appointments)} sub="Total in range" />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Completed" value={int(stats.completed)} sub="Completed in range" />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Commissions" value={`₱${money(stats.commissions)}`} sub="From completed" />
        </Grid>

        {/* Chart 1: Daily appointments (bar chart) */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ borderRadius: 4, height: 420 }}>
            <CardContent sx={{ height: "100%" }}>
              <Typography sx={{ fontWeight: 800 }}>Appointments per day</Typography>
              <Typography variant="body2" color="text.secondary">
                Total vs Completed
              </Typography>

              <Box sx={{ mt: 2, height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={daily}>
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" name="Total" />
                    <Bar dataKey="completed" name="Completed" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Chart 2: Status breakdown (pie chart) */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ borderRadius: 4, height: 420 }}>
            <CardContent sx={{ height: "100%" }}>
              <Typography sx={{ fontWeight: 800 }}>Status breakdown</Typography>
              <Typography variant="body2" color="text.secondary">
                Appointment status distribution
              </Typography>

              <Box sx={{ mt: 2, height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={status}
                      dataKey="cnt"
                      nameKey="status"
                      outerRadius="80%"
                      label
                    >
                      {status.map((_, i) => (
                        <Cell key={i} fill={pieFills[i % pieFills.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* New clients */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ borderRadius: 4 }}>
            <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
              <Box>
                <Typography sx={{ fontWeight: 800 }}>New clients</Typography>
                <Typography variant="body2" color="text.secondary">
                  Clients created in selected range
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>
                {int(stats.new_clients)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}