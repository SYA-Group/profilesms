// src/components/ProtectedRoute.tsx
import type { JSX } from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");

  if (!token) return <Navigate to="/login" replace />;

  return children;
};

export default ProtectedRoute;
