// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import Grid from "@mui/material/GridLegacy";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PaidIcon from "@mui/icons-material/Paid";
import EventIcon from "@mui/icons-material/Event";
import PercentIcon from "@mui/icons-material/Percent";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Legend,
} from "recharts";

import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

type Payment = {
  id: number;
  appointment_id: number;
  client_name?: string | null;
  amount: number;
  method?: string | null;
  status: string;
  paid_at: string;
};

type Appointment = {
  id: number;
  client_id: number;
  staff_id: number;
  client_name: string;
  staff_name: string;
  start_at: string;
  end_at: string;
  status: string;
  notes?: string | null;
};

type Commission = {
  id: number;
  staff_id: number;
  staff_name?: string | null;
  appointment_id: number;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  created_at?: string | null;
};

type Staff = { id: number; first_name: string; last_name: string; status: string };

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function inRange(dt: Date, from: Date, to: Date) {
  const t = dt.getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function ymdFromDate(d: Date) {
  return isoDate(d);
}

function safeDate(v: string) {
  // accepts ISO or "YYYY-MM-DD HH:mm:ss"
  const d = new Date(String(v || "").replace(" ", "T"));
  return d;
}

function money(v: any) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

function pct(v: any) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "0.00%";
  return `${x.toFixed(2)}%`;
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card sx={{ borderRadius: 4 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, mt: 0.5 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>

          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 3,
              display: "grid",
              placeItems: "center",
              bgcolor: "rgba(15,118,110,0.10)",
              color: "secondary.main",
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { activeBranchId } = useAuth();

  // default last 7 days
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return isoDate(d);
  });
  const [to, setTo] = useState(() => isoDate(new Date()));

  const [loading, setLoading] = useState(true);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  const range = useMemo(() => {
    const f = parseYmd(from);
    const t = parseYmd(to);
    t.setHours(23, 59, 59, 999);
    return { f, t };
  }, [from, to]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [p, a, c, s] = await Promise.all([
        api.get("/payments"),
        api.get("/appointments"),
        api.get("/commissions"),
        api.get("/staff"),
      ]);

      setPayments((p.data?.rows || []) as Payment[]);
      setAppointments((a.data?.rows || []) as Appointment[]);
      setCommissions((c.data?.rows || []) as Commission[]);
      setStaff((s.data?.rows || []) as Staff[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // branch change should refetch
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId]);

  // FILTERED DATA (by date range)
  const paymentsInRange = useMemo(() => {
    return payments.filter((x) => {
      const d = safeDate(x.paid_at);
      return !Number.isNaN(d.getTime()) ? inRange(d, range.f, range.t) : true;
    });
  }, [payments, range.f, range.t]);

  const apptsInRange = useMemo(() => {
    // use start_at for range
    return appointments.filter((x) => {
      const d = safeDate(x.start_at);
      return !Number.isNaN(d.getTime()) ? inRange(d, range.f, range.t) : true;
    });
  }, [appointments, range.f, range.t]);

  const commissionsInRange = useMemo(() => {
    // prefer created_at; if missing, just include
    return commissions.filter((x) => {
      if (!x.created_at) return true;
      const d = safeDate(x.created_at);
      return !Number.isNaN(d.getTime()) ? inRange(d, range.f, range.t) : true;
    });
  }, [commissions, range.f, range.t]);

  // KPI CALCS
  const kpis = useMemo(() => {
    const paid = paymentsInRange.filter((p) => (p.status || "").toLowerCase() === "paid");
    const salesTotal = paid.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const salesCount = paid.length;
    const avgTicket = salesCount > 0 ? salesTotal / salesCount : 0;

    const apptCount = apptsInRange.length;
    const completedAppts = apptsInRange.filter((a) => a.status === "completed").length;

    const commissionTotal = commissionsInRange.reduce((acc, c) => acc + Number(c.commission_amount || 0), 0);
    const grossTotal = commissionsInRange.reduce((acc, c) => acc + Number(c.gross_amount || 0), 0);
    const avgRate = grossTotal > 0 ? (commissionTotal / grossTotal) * 100 : 0;

    return {
      salesTotal,
      salesCount,
      avgTicket,
      apptCount,
      completedAppts,
      commissionTotal,
      avgRate,
    };
  }, [paymentsInRange, apptsInRange, commissionsInRange]);

  // CHART: Sales over time (paid payments sum per day)
  const salesSeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of paymentsInRange) {
      if ((p.status || "").toLowerCase() !== "paid") continue;
      const d = safeDate(p.paid_at);
      const key = !Number.isNaN(d.getTime()) ? ymdFromDate(d) : "unknown";
      map.set(key, (map.get(key) || 0) + Number(p.amount || 0));
    }
    const keys = Array.from(map.keys()).filter((k) => k !== "unknown").sort();
    return keys.map((k) => ({ day: k, sales: Number(map.get(k) || 0) }));
  }, [paymentsInRange]);

  // CHART: Appointments by status
  const apptStatusSeries = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of apptsInRange) {
      const s = String(a.status || "unknown");
      counts[s] = (counts[s] || 0) + 1;
    }
    const order = ["booked", "checked_in", "completed", "cancelled", "no_show"];
    const keys = Array.from(new Set([...order, ...Object.keys(counts)]));
    return keys
      .filter((k) => counts[k])
      .map((k) => ({ status: k.replace("_", " "), count: counts[k] || 0 }));
  }, [apptsInRange]);

  // CHART: Payment methods (paid only)
  const paymentMethodSeries = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of paymentsInRange) {
      if ((p.status || "").toLowerCase() !== "paid") continue;
      const m = (p.method || "unknown").toLowerCase();
      counts[m] = (counts[m] || 0) + 1;
    }
    return Object.keys(counts)
      .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
      .map((k) => ({ method: k, count: counts[k] || 0 }));
  }, [paymentsInRange]);

  // CHART: Top staff by commission
  const topStaffSeries = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of commissionsInRange) {
      const sid = Number(c.staff_id || 0);
      if (!sid) continue;
      map.set(sid, (map.get(sid) || 0) + Number(c.commission_amount || 0));
    }
    const name = (sid: number) => {
      const s = staff.find((x) => x.id === sid);
      if (s) return `${s.first_name} ${s.last_name}`.trim();
      const fromRow = commissionsInRange.find((x) => Number(x.staff_id) === sid)?.staff_name;
      return fromRow ? String(fromRow) : `Staff #${sid}`;
    };

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([sid, total]) => ({ staff: name(sid), commission: Number(total) }));
  }, [commissionsInRange, staff, commissionsInRange]);

  return (
    <Box>
      {/* Header + date range */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ alignItems: { md: "center" }, justifyContent: "space-between", mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Business overview • Filter by date range
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} sx={{ minWidth: { md: 520 } }}>
          <TextField
            label="From"
            type="date"
            size="small"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CalendarMonthIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            fullWidth
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <Chip
            label={loading ? "Loading…" : "Updated"}
            variant="outlined"
            sx={{ fontWeight: 900, alignSelf: { xs: "flex-start", sm: "center" } }}
          />
        </Stack>
      </Stack>

      {/* KPI cards */}
      <Grid container spacing={2.5}>
        <Grid xs={12} sm={6} md={3}>
          <StatCard
            title="Sales (Paid)"
            value={`₱${money(kpis.salesTotal)}`}
            subtitle={`${kpis.salesCount} payments • Avg ₱${money(kpis.avgTicket)}`}
            icon={<PaidIcon />}
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard
            title="Appointments"
            value={`${kpis.apptCount}`}
            subtitle={`${kpis.completedAppts} completed`}
            icon={<EventIcon />}
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard
            title="Commission"
            value={`₱${money(kpis.commissionTotal)}`}
            subtitle={`Avg rate ${pct(kpis.avgRate)}`}
            icon={<PercentIcon />}
          />
        </Grid>
        <Grid xs={12} sm={6} md={3}>
          <StatCard
            title="Records"
            value={`${paymentsInRange.length + apptsInRange.length + commissionsInRange.length}`}
            subtitle="Payments + Appointments + Commissions"
            icon={<ReceiptLongIcon />}
          />
        </Grid>
      </Grid>

      <Box sx={{ height: 14 }} />

      {/* Charts */}
      <Grid container spacing={2.5}>
        {/* Sales line */}
        <Grid xs={12} md={7}>
          <Card sx={{ borderRadius: 4, height: 420 }}>
            <CardContent sx={{ height: "100%" }}>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Box>
                  <Typography sx={{ fontWeight: 900 }}>Sales over time</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Paid payments grouped per day
                  </Typography>
                </Box>
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="sales" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>

              {salesSeries.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No paid payments in selected range.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Payments method pie */}
        <Grid xs={12} md={5}>
          <Card sx={{ borderRadius: 4, height: 420 }}>
            <CardContent sx={{ height: "100%" }}>
              <Typography sx={{ fontWeight: 900 }}>Payment methods</Typography>
              <Typography variant="body2" color="text.secondary">
                Paid payments count per method
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentMethodSeries} dataKey="count" nameKey="method" outerRadius={110} label />
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>

              {paymentMethodSeries.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No paid payments in selected range.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Appointment status bar */}
        <Grid xs={12} md={6}>
          <Card sx={{ borderRadius: 4, height: 420 }}>
            <CardContent sx={{ height: "100%" }}>
              <Typography sx={{ fontWeight: 900 }}>Appointments by status</Typography>
              <Typography variant="body2" color="text.secondary">
                Count per status (range uses appointment start date)
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={apptStatusSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>

              {apptStatusSeries.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No appointments in selected range.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Top staff by commission */}
        <Grid xs={12} md={6}>
          <Card sx={{ borderRadius: 4, height: 420 }}>
            <CardContent sx={{ height: "100%" }}>
              <Typography sx={{ fontWeight: 900 }}>Top staff by commission</Typography>
              <Typography variant="body2" color="text.secondary">
                Total commission amount (range uses commission created_at)
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topStaffSeries} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="staff" tick={{ fontSize: 12 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="commission" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>

              {topStaffSeries.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No commissions in selected range.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ height: 18 }} />

      <Card sx={{ borderRadius: 4 }}>
        <CardContent>
          <Typography sx={{ fontWeight: 900 }}>Tips</Typography>
          <Typography variant="body2" color="text.secondary">
            For best accuracy, make sure your Payments status uses <b>paid</b> for successful payments, and Appointments
            status uses <b>completed</b> to generate commissions.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}