import { useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import LockResetIcon from "@mui/icons-material/LockReset";
import LogoutIcon from "@mui/icons-material/Logout";

import ProfileDialog from "./ProfileDialog";
import ChangePasswordDialog from "./ChangePasswordDialog";
import { useAuth } from "../auth/AuthContext";

function initials(email?: string) {
  if (!email) return "U";
  return email.slice(0, 2).toUpperCase();
}

export default function UserMenu({ onLogout }: { onLogout: () => void }) {
  const { me } = useAuth();

  const email = me?.user?.email || "";
  const role = me?.user?.role || "staff";

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const [openProfile, setOpenProfile] = useState(false);
  const [openPass, setOpenPass] = useState(false);

  const avatarText = useMemo(() => initials(email), [email]);

  return (
    <>
      <Tooltip title="Account">
        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 0.25 }}>
          <Avatar sx={{ width: 36, height: 36, fontWeight: 900 }}>{avatarText}</Avatar>
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        PaperProps={{
          sx: { width: 260, borderRadius: 3, overflow: "hidden" },
        }}
      >
        <Box sx={{ px: 2, py: 1.6 }}>
          <Typography sx={{ fontWeight: 900 }} noWrap>
            {email || "User"}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Role: {role}
          </Typography>
        </Box>
        <Divider />

        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            setOpenProfile(true);
          }}
        >
          <ListItemIcon>
            <PersonOutlineIcon fontSize="small" />
          </ListItemIcon>
          Edit Profile
        </MenuItem>

        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            setOpenPass(true);
          }}
        >
          <ListItemIcon>
            <LockResetIcon fontSize="small" />
          </ListItemIcon>
          Change Password
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            onLogout();
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      <ProfileDialog open={openProfile} onClose={() => setOpenProfile(false)} />
      <ChangePasswordDialog open={openPass} onClose={() => setOpenPass(false)} />
    </>
  );
}