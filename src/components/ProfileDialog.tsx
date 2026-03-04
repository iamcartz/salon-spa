import { useEffect, useState } from "react";
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
import { useAuth } from "../auth/AuthContext";

type MeProfile = {
  email: string;
  role: "admin" | "staff";
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
};

export default function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me } = useAuth();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");

  const email = me?.user?.email || "";
  const role = me?.user?.role || "staff";

  useEffect(() => {
    if (!open) return;

    setErr("");
    setLoading(true);

    (async () => {
      try {
        const r = await api.get("/users/me");
        const u: MeProfile = r.data?.user || r.data || {};
        setFirst(String(u.first_name ?? ""));
        setLast(String(u.last_name ?? ""));
        setPhone(String(u.phone ?? ""));
      } catch (e: any) {
        // fallback: allow edit anyway
        setFirst("");
        setLast("");
        setPhone("");
        setErr("Could not load profile (endpoint missing or blocked). You can still try saving.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const save = async () => {
    setErr("");
    setLoading(true);
    try {
      await api.put("/users/me", {
        first_name: first.trim(),
        last_name: last.trim(),
        phone: phone.trim(),
      });
      onClose();
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 900 }}>Edit Profile</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        {!!err && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {err}
          </Alert>
        )}

        <Box sx={{ display: "grid", gap: 2, mt: 1 }}>
          <TextField label="Email" value={email} disabled />
          <TextField label="Role" value={role} disabled />

          <TextField label="First Name" value={first} onChange={(e) => setFirst(e.target.value)} />
          <TextField label="Last Name" value={last} onChange={(e) => setLast(e.target.value)} />
          <TextField label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={loading} sx={{ fontWeight: 900 }}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}