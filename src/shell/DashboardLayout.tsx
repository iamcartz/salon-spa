import { Outlet, NavLink, useLocation } from "react-router-dom";
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
} from "@mui/material";
import { useTheme } from "@mui/material/styles";

import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import SpaIcon from "@mui/icons-material/Spa";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import GroupIcon from "@mui/icons-material/Group";
import PaidIcon from "@mui/icons-material/Paid";
import NotificationsIcon from "@mui/icons-material/Notifications";
import EventIcon from "@mui/icons-material/Event";
import PaymentsIcon from "@mui/icons-material/Payments";

import { useAuth } from "../auth/AuthContext";
import UserMenu from "../components/UserMenu";

const drawerWidth = 260;

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { to: "/clients", label: "Clients", icon: <PeopleIcon /> },
  { to: "/services", label: "Services", icon: <SpaIcon /> },
  { to: "/inventory", label: "Inventory", icon: <Inventory2Icon /> },
  { to: "/staff", label: "Staff", icon: <GroupIcon /> },
  { to: "/commissions", label: "Commissions", icon: <PaidIcon /> },
  { to: "/appointments", label: "Appointments", icon: <EventIcon /> },
  { to: "/payments", label: "Payments", icon: <PaymentsIcon /> },
];

function BrandBlock() {
  return (
    <Box sx={{ px: 2.2, py: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: -0.5 }}>
        MJ Store
      </Typography>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        Admin / Staff Panel
      </Typography>
    </Box>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const loc = useLocation();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <BrandBlock />
      <Divider sx={{ opacity: 0.5 }} />

      <List sx={{ px: 1.2, py: 1.2 }}>
        {nav.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            onClick={onNavigate}
            selected={loc.pathname === item.to}
            sx={{
              borderRadius: 2,
              mb: 0.75,
              py: 1.1,
              "&.Mui-selected": {
                bgcolor: "rgba(15,118,110,0.12)",
              },
              "& .MuiListItemIcon-root": { minWidth: 40 },
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontWeight: 700 }}
            />
          </ListItemButton>
        ))}
      </List>

      <Box sx={{ mt: "auto", px: 2.2, py: 2, color: "text.secondary", fontSize: 12 }}>
        © {new Date().getFullYear()} Salon App
      </Box>
    </Box>
  );
}

export default function DashboardLayout() {
  const { me, logout, activeBranchId, setActiveBranchId } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [mobileOpen, setMobileOpen] = useState(false);

  const branches = useMemo(() => me?.branches || [], [me]);
  const canPickBranch = branches.length > 0;

  const handleBranchChange = (id: string) => {
    // keep BOTH keys so your api interceptor works even if it reads `branch_id`
    localStorage.setItem("branch_id", id);
    setActiveBranchId(id);
  };

  const drawer = (
    <SideNav
      onNavigate={() => {
        if (isMobile) setMobileOpen(false);
      }}
    />
  );

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
          <Toolbar sx={{ gap: 1.5 }}>
            {isMobile && (
              <IconButton onClick={() => setMobileOpen(true)} edge="start" sx={{ mr: 0.5 }}>
                <MenuIcon />
              </IconButton>
            )}

            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 900, letterSpacing: -0.3 }} noWrap>
                Hi, Welcome back 👋
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }} noWrap>
                Manage appointments, staff, services, inventory & payments
              </Typography>
            </Box>

            <Box sx={{ flex: 1 }} />

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

            <IconButton>
              <Badge badgeContent={2} color="primary">
                <NotificationsIcon />
              </Badge>
            </IconButton>

            <UserMenu onLogout={logout} />
          </Toolbar>

          {/* Mobile branch picker */}
          {isMobile && (
            <Box sx={{ px: 2, pb: 1.5 }}>
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