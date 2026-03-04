import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { api } from "../lib/api";

export default function ChangePasswordDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setOldPass("");
    setNewPass("");
    setConfirm("");
    setErr("");
    setOk("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const save = async () => {
    setErr("");
    setOk("");

    if (!oldPass || !newPass) {
      setErr("Old and new password are required.");
      return;
    }
    if (newPass.length < 8) {
      setErr("New password must be at least 8 characters.");
      return;
    }
    if (newPass !== confirm) {
      setErr("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.put("/users/me/password", { old_password: oldPass, new_password: newPass });
      setOk("Password updated successfully.");
      setOldPass("");
      setNewPass("");
      setConfirm("");
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>Change Password</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        {!!err && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err}
          </Alert>
        )}
        {!!ok && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {ok}
          </Alert>
        )}

        <Box sx={{ display: "grid", gap: 2, mt: 1 }}>
          <TextField
            label="Old Password"
            type="password"
            value={oldPass}
            onChange={(e) => setOldPass(e.target.value)}
          />
          <TextField
            label="New Password"
            type="password"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
          />
          <TextField
            label="Confirm New Password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={close} disabled={loading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={loading} sx={{ fontWeight: 900 }}>
          Update
        </Button>
      </DialogActions>
    </Dialog>
  );
}