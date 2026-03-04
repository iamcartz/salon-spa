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
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip as MuiTooltip,
} from "@mui/material";

import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PaidIcon from "@mui/icons-material/Paid";
import EventIcon from "@mui/icons-material/Event";
import PercentIcon from "@mui/icons-material/Percent";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import RefreshIcon from "@mui/icons-material/Refresh";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";

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
  amount: number;
  method?: string | null;
  status: string;
  paid_at: string;
};

type Appointment = {
  id: number;
  client_name: string;
  staff_name: string;
  start_at: string;
  end_at: string;
  status: string;
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

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Accepts:
 * - "YYYY-MM-DD"
 * - "MM/DD/YYYY"
 * - "YYYY-MM-DD HH:mm:ss"
 * - ISO strings
 */
function parseDateAny(input: string): Date | null {
  const v = String(input || "").trim();
  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [mm, dd, yyyy] = v.split("/").map((n) => Number(n));
    const d = new Date(yyyy, (mm || 1) - 1, dd || 1, 0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inRange(dt: Date, from: Date, to: Date) {
  const t = dt.getTime();
  return t >= from.getTime() && t <= to.getTime();
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

function percentDelta(curr: number, prev: number) {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return 0;
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function kpiDeltaChip(delta: number) {
  const up = delta >= 0;
  return (
    <Chip
      size="small"
      icon={up ? <TrendingUpIcon /> : <TrendingDownIcon />}
      label={`${up ? "+" : ""}${delta.toFixed(1)}%`}
      sx={{
        fontWeight: 900,
        borderRadius: 2,
        bgcolor: up ? "rgba(16,185,129,0.10)" : "rgba(239,68,68,0.10)",
        color: up ? "rgb(16,185,129)" : "rgb(239,68,68)",
        "& .MuiChip-icon": { color: "inherit" },
      }}
    />
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  delta,
  spark,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  delta?: number;
  spark?: { x: string; y: number }[];
}) {
  return (
    <Card sx={{ borderRadius: 4, height: "100%", overflow: "hidden" }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" noWrap>
              {title}
            </Typography>

            <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", mt: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: -0.3 }}>
                {value}
              </Typography>
              {typeof delta === "number" && (
                <MuiTooltip title="Compared to previous period">
                  <Box sx={{ display: "inline-flex" }}>{kpiDeltaChip(delta)}</Box>
                </MuiTooltip>
              )}
            </Stack>

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
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        </Stack>

        {/* sparkline */}
        <Box sx={{ mt: 1.6, height: 44 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark || []}>
              <Line type="monotone" dataKey="y" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
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
    return toISODate(d);
  });
  const [to, setTo] = useState(() => toISODate(new Date()));

  const [quick, setQuick] = useState<string>("");

  const [loading, setLoading] = useState(true);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  const range = useMemo(() => {
    const f = startOfDay(parseDateAny(from) ?? new Date(0));
    const t = endOfDay(parseDateAny(to) ?? new Date());
    return { f, t };
  }, [from, to]);

  // previous range (same length)
  const prevRange = useMemo(() => {
    const days = Math.max(1, Math.ceil((range.t.getTime() - range.f.getTime()) / 86400000) + 1);
    const prevTo = endOfDay(new Date(range.f.getTime() - 1));
    const prevFrom = startOfDay(new Date(prevTo.getTime() - (days - 1) * 86400000));
    return { f: prevFrom, t: prevTo };
  }, [range.f, range.t]);

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
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId]);

  // quick ranges
  useEffect(() => {
    if (!quick) return;
    const now = new Date();

    if (quick === "today") {
      setFrom(toISODate(now));
      setTo(toISODate(now));
    }

    if (quick === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setFrom(toISODate(d));
      setTo(toISODate(now));
    }

    if (quick === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      setFrom(toISODate(d));
      setTo(toISODate(now));
    }

    if (quick === "month") {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      setFrom(toISODate(f));
      setTo(toISODate(now));
    }
  }, [quick]);

  // FILTERED DATA (by date range)
  const paymentsInRange = useMemo(() => {
    return payments.filter((x) => {
      const d = parseDateAny(x.paid_at);
      return d ? inRange(d, range.f, range.t) : true;
    });
  }, [payments, range.f, range.t]);

  const apptsInRange = useMemo(() => {
    return appointments.filter((x) => {
      const d = parseDateAny(x.start_at);
      return d ? inRange(d, range.f, range.t) : true;
    });
  }, [appointments, range.f, range.t]);

  const commissionsInRange = useMemo(() => {
    return commissions.filter((x) => {
      if (!x.created_at) return true;
      const d = parseDateAny(x.created_at);
      return d ? inRange(d, range.f, range.t) : true;
    });
  }, [commissions, range.f, range.t]);

  // PREVIOUS PERIOD FILTERS
  const paymentsPrev = useMemo(() => {
    return payments.filter((x) => {
      const d = parseDateAny(x.paid_at);
      return d ? inRange(d, prevRange.f, prevRange.t) : false;
    });
  }, [payments, prevRange.f, prevRange.t]);

  const apptsPrev = useMemo(() => {
    return appointments.filter((x) => {
      const d = parseDateAny(x.start_at);
      return d ? inRange(d, prevRange.f, prevRange.t) : false;
    });
  }, [appointments, prevRange.f, prevRange.t]);

  const commissionsPrev = useMemo(() => {
    return commissions.filter((x) => {
      if (!x.created_at) return false;
      const d = parseDateAny(x.created_at);
      return d ? inRange(d, prevRange.f, prevRange.t) : false;
    });
  }, [commissions, prevRange.f, prevRange.t]);

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

    return { salesTotal, salesCount, avgTicket, apptCount, completedAppts, commissionTotal, avgRate };
  }, [paymentsInRange, apptsInRange, commissionsInRange]);

  const kpisPrev = useMemo(() => {
    const paid = paymentsPrev.filter((p) => (p.status || "").toLowerCase() === "paid");
    const salesTotal = paid.reduce((acc, p) => acc + Number(p.amount || 0), 0);

    const apptCount = apptsPrev.length;

    const commissionTotal = commissionsPrev.reduce((acc, c) => acc + Number(c.commission_amount || 0), 0);

    const records = paymentsPrev.length + apptsPrev.length + commissionsPrev.length;

    return { salesTotal, apptCount, commissionTotal, records };
  }, [paymentsPrev, apptsPrev, commissionsPrev]);

  const deltas = useMemo(() => {
    const salesDelta = percentDelta(kpis.salesTotal, kpisPrev.salesTotal);
    const apptDelta = percentDelta(kpis.apptCount, kpisPrev.apptCount);
    const commDelta = percentDelta(kpis.commissionTotal, kpisPrev.commissionTotal);
    const recDelta = percentDelta(
      paymentsInRange.length + apptsInRange.length + commissionsInRange.length,
      kpisPrev.records
    );
    return { salesDelta, apptDelta, commDelta, recDelta };
  }, [kpis, kpisPrev, paymentsInRange.length, apptsInRange.length, commissionsInRange.length]);

  // CHART: Sales over time (paid payments sum per day)
  const salesSeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of paymentsInRange) {
      if ((p.status || "").toLowerCase() !== "paid") continue;
      const d = parseDateAny(p.paid_at);
      if (!d) continue;
      const key = toISODate(d);
      map.set(key, (map.get(key) || 0) + Number(p.amount || 0));
    }
    const keys = Array.from(map.keys()).sort();
    return keys.map((k) => ({ day: k, sales: Number(map.get(k) || 0) }));
  }, [paymentsInRange]);

  // KPI sparklines (reuse salesSeries + simple series)
  const sparkSales = useMemo(() => salesSeries.map((x) => ({ x: x.day, y: x.sales })), [salesSeries]);

  const sparkAppts = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of apptsInRange) {
      const d = parseDateAny(a.start_at);
      if (!d) continue;
      const key = toISODate(d);
      map.set(key, (map.get(key) || 0) + 1);
    }
    const keys = Array.from(map.keys()).sort();
    return keys.map((k) => ({ x: k, y: map.get(k) || 0 }));
  }, [apptsInRange]);

  const sparkComms = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of commissionsInRange) {
      const d = c.created_at ? parseDateAny(c.created_at) : null;
      if (!d) continue;
      const key = toISODate(d);
      map.set(key, (map.get(key) || 0) + Number(c.commission_amount || 0));
    }
    const keys = Array.from(map.keys()).sort();
    return keys.map((k) => ({ x: k, y: map.get(k) || 0 }));
  }, [commissionsInRange]);

  const sparkRecords = useMemo(() => {
    // simple: one point daily = payments+appts+commissions
    const map = new Map<string, number>();
    for (const p of paymentsInRange) {
      const d = parseDateAny(p.paid_at);
      if (!d) continue;
      const key = toISODate(d);
      map.set(key, (map.get(key) || 0) + 1);
    }
    for (const a of apptsInRange) {
      const d = parseDateAny(a.start_at);
      if (!d) continue;
      const key = toISODate(d);
      map.set(key, (map.get(key) || 0) + 1);
    }
    for (const c of commissionsInRange) {
      const d = c.created_at ? parseDateAny(c.created_at) : null;
      if (!d) continue;
      const key = toISODate(d);
      map.set(key, (map.get(key) || 0) + 1);
    }
    const keys = Array.from(map.keys()).sort();
    return keys.map((k) => ({ x: k, y: map.get(k) || 0 }));
  }, [paymentsInRange, apptsInRange, commissionsInRange]);

  // CHART: Appointments by status
  const apptStatusSeries = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of apptsInRange) {
      const s = String(a.status || "unknown");
      counts[s] = (counts[s] || 0) + 1;
    }
    const order = ["booked", "checked_in", "completed", "cancelled", "no_show"];
    const keys = Array.from(new Set([...order, ...Object.keys(counts)]));
    return keys.map((k) => ({ status: k.replace("_", " "), count: counts[k] || 0 })).filter((x) => x.count > 0);
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
  }, [commissionsInRange, staff]);

  // ✅ FIXED: UI spacing with consistent container padding + overflow protection
  return (
    <Box
      sx={{
        width: "100%",
        pb: 4,
        pt: 2,
        px: { xs: 2, sm: 3, md: 3.5 }, // ✅ adds left/right padding
        overflowX: "hidden", // ✅ prevents Grid negative margin overflow
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 1400, mx: "auto" }}>
        {/* Header + filters */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ alignItems: { md: "center" }, justifyContent: "space-between", mb: 2.5 }}
        >
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: -0.4 }}>
              Dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Business overview • Filter by date range • Compare vs previous period
            </Typography>
          </Box>

          <Stack spacing={1.2} sx={{ width: { xs: "100%", md: 760 } }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
              <TextField
                label="From"
                type="date"
                size="small"
                value={from}
                onChange={(e) => {
                  setQuick("");
                  setFrom(e.target.value);
                }}
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
                onChange={(e) => {
                  setQuick("");
                  setTo(e.target.value);
                }}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />

              <Button
                onClick={fetchAll}
                variant="outlined"
                startIcon={<RefreshIcon />}
                sx={{
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                  flexShrink: 0,          // ✅ stop shrinking (fixes icon overflow)
                  minWidth: 128,          // ✅ keep enough room for icon + text
                  height: 40,             // ✅ match MUI small TextField height
                  px: 2,
                  "& .MuiButton-startIcon": {
                    marginLeft: 0,        // ✅ keep icon inside
                    marginRight: 0.75,
                  },
                }}
              >
                Refresh
              </Button>

              <Chip
                label={loading ? "Loading…" : "Updated"}
                variant="outlined"
                sx={{
                  fontWeight: 900,
                  alignSelf: "center",
                  flexShrink: 0,          // ✅ don’t compress
                  height: 40,             // ✅ same height as inputs/button
                  "& .MuiChip-label": { px: 1.25 },
                }}
              />

              <Chip
                label={loading ? "Loading…" : "Updated"}
                variant="outlined"
                sx={{ fontWeight: 900, alignSelf: "center" }}
              />
            </Stack>

            <Stack direction="row" spacing={1} sx={{ justifyContent: { xs: "flex-start", md: "flex-end" } }}>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={quick}
                onChange={(_, v) => setQuick(v || "")}
                sx={{
                  "& .MuiToggleButton-root": { fontWeight: 900, textTransform: "none", px: 1.4 },
                }}
              >
                <ToggleButton value="today">Today</ToggleButton>
                <ToggleButton value="7d">Last 7d</ToggleButton>
                <ToggleButton value="30d">Last 30d</ToggleButton>
                <ToggleButton value="month">This month</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>
        </Stack>

        {/* KPI cards */}
        <Grid container spacing={2.5}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Sales (Paid)"
              value={`₱${money(kpis.salesTotal)}`}
              subtitle={`${kpis.salesCount} payments • Avg ₱${money(kpis.avgTicket)}`}
              icon={<PaidIcon />}
              delta={deltas.salesDelta}
              spark={sparkSales}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Appointments"
              value={`${kpis.apptCount}`}
              subtitle={`${kpis.completedAppts} completed`}
              icon={<EventIcon />}
              delta={deltas.apptDelta}
              spark={sparkAppts}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Commission"
              value={`₱${money(kpis.commissionTotal)}`}
              subtitle={`Avg rate ${pct(kpis.avgRate)}`}
              icon={<PercentIcon />}
              delta={deltas.commDelta}
              spark={sparkComms}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Records"
              value={`${paymentsInRange.length + apptsInRange.length + commissionsInRange.length}`}
              subtitle="Payments + Appointments + Commissions"
              icon={<ReceiptLongIcon />}
              delta={deltas.recDelta}
              spark={sparkRecords}
            />
          </Grid>
        </Grid>

        <Box sx={{ height: 18 }} />

        {/* Charts */}
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={7}>
            <Card sx={{ borderRadius: 4, height: 440 }}>
              <CardContent sx={{ p: 2.5, height: "100%", display: "flex", flexDirection: "column" }}>
                <Stack direction="row" sx={{ alignItems: "baseline", justifyContent: "space-between" }}>
                  <Box>
                    <Typography sx={{ fontWeight: 950 }}>Sales over time</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Paid payments grouped per day
                    </Typography>
                  </Box>
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="sales" strokeWidth={3} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>

                {salesSeries.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    No paid payments in selected range.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={5}>
            <Card sx={{ borderRadius: 4, height: 440 }}>
              <CardContent sx={{ p: 2.5, height: "100%", display: "flex", flexDirection: "column" }}>
                <Box>
                  <Typography sx={{ fontWeight: 950 }}>Payment methods</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Paid payments count per method
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentMethodSeries} dataKey="count" nameKey="method" outerRadius={115} label />
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>

                {paymentMethodSeries.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    No paid payments in selected range.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 4, height: 440 }}>
              <CardContent sx={{ p: 2.5, height: "100%", display: "flex", flexDirection: "column" }}>
                <Box>
                  <Typography sx={{ fontWeight: 950 }}>Appointments by status</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Count per status (range uses appointment start date)
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ flex: 1, minHeight: 0 }}>
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
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    No appointments in selected range.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 4, height: 440 }}>
              <CardContent sx={{ p: 2.5, height: "100%", display: "flex", flexDirection: "column" }}>
                <Box>
                  <Typography sx={{ fontWeight: 950 }}>Top staff by commission</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total commission amount (range uses commission created_at)
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ flex: 1, minHeight: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topStaffSeries} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="staff" tick={{ fontSize: 12 }} width={130} />
                      <Tooltip />
                      <Bar dataKey="commission" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>

                {topStaffSeries.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    No commissions in selected range.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}