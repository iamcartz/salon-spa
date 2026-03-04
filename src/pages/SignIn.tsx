import { useState } from "react";
import { Card, CardContent, TextField, Button, Typography, Box, Alert } from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

export default function SignIn() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@local.test");
  const [password, setPassword] = useState("Admin@12345");
  const [err, setErr] = useState("");

  const onSubmit = async () => {
    setErr("");
    try {
      await login(email, password);
      nav("/dashboard");
    } catch (e: any) {
      setErr(e?.response?.data?.error || "Login failed");
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", bgcolor: "background.default", p: 2 }}>
      <Card sx={{ width: 420, borderRadius: 4 }}>
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>Sign in</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Admin / Staff access only
          </Typography>

          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

          <TextField fullWidth label="Email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} />
          <TextField fullWidth label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} sx={{ mb: 2 }} />

          <Button fullWidth variant="contained" onClick={onSubmit} sx={{ py: 1.2, fontWeight: 800 }}>
            Sign in
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}