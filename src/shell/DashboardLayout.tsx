import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  MenuItem,
  Select,
  Badge,
  useMediaQuery,
  Divider,
  TextField,
  InputAdornment,
  Button,
  Menu,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import NotificationsIcon from "@mui/icons-material/Notifications";

import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import SpaIcon from "@mui/icons-material/Spa";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import GroupIcon from "@mui/icons-material/Group";
import PaidIcon from "@mui/icons-material/Paid";
import EventIcon from "@mui/icons-material/Event";
import PaymentsIcon from "@mui/icons-material/Payments";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";

import { useAuth } from "../auth/AuthContext";
import UserMenu from "../components/UserMenu";

const drawerWidth = 260;

type NavItem = { to: string; label: string; icon: React.ReactNode; adminOnly?: boolean };

const nav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { to: "/clients", label: "Clients", icon: <PeopleIcon /> },
  { to: "/services", label: "Services", icon: <SpaIcon /> },
  { to: "/inventory", label: "Inventory", icon: <Inventory2Icon /> },
  { to: "/staff", label: "Staff", icon: <GroupIcon /> },
  { to: "/commissions", label: "Commissions", icon: <PaidIcon /> },
  { to: "/appointments", label: "Appointments", icon: <EventIcon /> },
  { to: "/payments", label: "Payments", icon: <PaymentsIcon /> },

  // ✅ Admin only
  { to: "/users", label: "Users", icon: <AdminPanelSettingsIcon />, adminOnly: true },
];

function BrandBlock() {
  return (
    <Box sx={{ px: 2.4, py: 2.1 }}>
      <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: -0.6 }}>
        MJ Store
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        Admin / Staff Panel
      </Typography>
    </Box>
  );
}

function SideNav({
  onNavigate,
  isAdmin,
}: {
  onNavigate?: () => void;
  isAdmin: boolean;
}) {
  const loc = useLocation();

  const items = useMemo(() => {
    return nav.filter((n) => (n.adminOnly ? isAdmin : true));
  }, [isAdmin]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <BrandBlock />
      <Divider sx={{ opacity: 0.5 }} />

      <List sx={{ px: 1.2, py: 1.2 }}>
        {items.map((item) => {
          const selected = loc.pathname === item.to;

          return (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              onClick={onNavigate}
              selected={selected}
              sx={{
                borderRadius: 2.5,
                mb: 0.85,
                py: 1.15,
                transition: "all 160ms ease",
                "&:hover": {
                  transform: "translateY(-1px)",
                  bgcolor: "rgba(15,118,110,0.06)",
                },
                "&.Mui-selected": {
                  bgcolor: "rgba(15,118,110,0.12)",
                },
                "& .MuiListItemIcon-root": { minWidth: 40 },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontWeight: selected ? 900 : 700 }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box sx={{ mt: "auto", px: 2.4, py: 2, color: "text.secondary", fontSize: 12 }}>
        © {new Date().getFullYear()} Salon App
      </Box>
    </Box>
  );
}

export default function DashboardLayout() {
  const { me, logout, activeBranchId, setActiveBranchId } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState("");

  const branches = useMemo(() => me?.branches || [], [me]);
  const canPickBranch = branches.length > 0;

  const isAdmin = (me?.user?.role || "staff") === "admin";

  // Quick add menu
  const [quickAnchor, setQuickAnchor] = useState<null | HTMLElement>(null);
  const quickOpen = Boolean(quickAnchor);

  const handleBranchChange = (id: string) => {
    // keep BOTH keys for consistency with interceptor + app state
    localStorage.setItem("branch_id", id);
    localStorage.setItem("activeBranchId", id);
    setActiveBranchId(id);
  };

  const drawer = (
    <SideNav
      isAdmin={isAdmin}
      onNavigate={() => {
        if (isMobile) setMobileOpen(false);
      }}
    />
  );

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;

    // Simple behavior: go to Clients and let you implement filtering later,
    // or replace with a dedicated /search page.
    navigate(`/clients?search=${encodeURIComponent(term)}`);
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "rgba(17,24,39,0.03)" }}>
      {/* Sidebar (desktop) */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              borderRight: "1px solid rgba(17,24,39,0.08)",
              bgcolor: "background.paper",
            },
          }}
        >
          {drawer}
        </Drawer>
      )}

      {/* Sidebar (mobile) */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              boxSizing: "border-box",
              borderRight: "1px solid rgba(17,24,39,0.08)",
              bgcolor: "background.paper",
            },
          }}
        >
          {drawer}
        </Drawer>
      )}

      {/* Main */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Topbar */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: "background.paper",
            borderBottom: "1px solid rgba(17,24,39,0.08)",
          }}
        >
          <Toolbar sx={{ gap: 1.2 }}>
            {isMobile && (
              <IconButton onClick={() => setMobileOpen(true)} edge="start">
                <MenuIcon />
              </IconButton>
            )}

            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, letterSpacing: -0.3 }} noWrap>
                Dashboard
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
                Overview & insights by branch
              </Typography>
            </Box>

            {/* Search (desktop/tablet) */}
            <Box sx={{ flex: 1, display: { xs: "none", md: "flex" }, mx: 2 }}>
              <Box component="form" onSubmit={onSearchSubmit} sx={{ width: "100%" }}>
                <TextField
                  size="small"
                  fullWidth
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search clients, services, staff…"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": { borderRadius: 999 },
                  }}
                />
              </Box>
            </Box>

            <Select
              size="small"
              value={activeBranchId}
              onChange={(e) => handleBranchChange(String(e.target.value))}
              sx={{ minWidth: 220, display: { xs: "none", sm: "inline-flex" } }}
              displayEmpty
              disabled={!canPickBranch}
            >
              {branches.map((b) => (
                <MenuItem key={b.id} value={String(b.id)}>
                  {b.name}
                </MenuItem>
              ))}
              {!canPickBranch && <MenuItem value="">No branches</MenuItem>}
            </Select>

            {/* Quick Add */}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={(e) => setQuickAnchor(e.currentTarget)}
              sx={{ fontWeight: 900, borderRadius: 999, display: { xs: "none", sm: "inline-flex" } }}
            >
              Quick Add
            </Button>

            <Menu
              anchorEl={quickAnchor}
              open={quickOpen}
              onClose={() => setQuickAnchor(null)}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              PaperProps={{ sx: { borderRadius: 3, width: 220 } }}
            >
              <MenuItem
                onClick={() => {
                  setQuickAnchor(null);
                  navigate("/clients");
                  // you can open your "Add Client" dialog automatically later
                }}
              >
                + Client
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setQuickAnchor(null);
                  navigate("/appointments");
                }}
              >
                + Appointment
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setQuickAnchor(null);
                  navigate("/services");
                }}
              >
                + Service
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setQuickAnchor(null);
                  navigate("/inventory");
                }}
              >
                + Inventory Item
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setQuickAnchor(null);
                  navigate("/staff");
                }}
              >
                + Staff
              </MenuItem>

              {isAdmin && (
                <MenuItem
                  onClick={() => {
                    setQuickAnchor(null);
                    navigate("/users");
                  }}
                >
                  + User (Admin)
                </MenuItem>
              )}
            </Menu>

            <IconButton>
              <Badge badgeContent={2} color="primary">
                <NotificationsIcon />
              </Badge>
            </IconButton>

            <UserMenu onLogout={logout} />
          </Toolbar>

          {/* Mobile row */}
          {isMobile && (
            <Box sx={{ px: 2, pb: 1.5, display: "grid", gap: 1 }}>
              <Select
                size="small"
                fullWidth
                value={activeBranchId}
                onChange={(e) => handleBranchChange(String(e.target.value))}
                displayEmpty
                disabled={!canPickBranch}
              >
                {branches.map((b) => (
                  <MenuItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </MenuItem>
                ))}
                {!canPickBranch && <MenuItem value="">No branches</MenuItem>}
              </Select>

              <Box component="form" onSubmit={onSearchSubmit}>
                <TextField
                  size="small"
                  fullWidth
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: 999 } }}
                />
              </Box>

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={(e) => setQuickAnchor(e.currentTarget)}
                sx={{ fontWeight: 900, borderRadius: 999 }}
              >
                Quick Add
              </Button>
            </Box>
          )}
        </AppBar>

        {/* Page content */}
        <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}