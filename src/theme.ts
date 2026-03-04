import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#0f766e" },      // teal
    secondary: { main: "#111827" },    // dark gray
    background: { default: "#f6f7fb", paper: "#ffffff" },
  },
  shape: { borderRadius: 14 },
});