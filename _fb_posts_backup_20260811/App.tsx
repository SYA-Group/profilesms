// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import UploadContacts from "./components/UploadContacts";
import SendPanel from "./components/SendPanel";
import ContactsTable from "./components/ContactsTable";
import Layout from "./components/Layout";
import Register from "./pages/Register";
import { Toaster } from "react-hot-toast";
import ForgotPassword from "./components/ForgotPassword";
import ResetPassword from "./components/ResetPassword";
import ChangePassword from "./components/ChangePassword";
import UpdateEmail from "./components/UpdateEmail";
import ContactSupport from "./components/ContactSupport";
import ManageUsers from "./pages/ManageUsers";
import Pricing from "./pages/Pricing";
import ElasticSearch from "./pages/ElasticSearch";
import PricingAdmin from "./pages/PricingAdmin";
import LeadRegister from "./pages/LeadRegister";
import Cookies from "js-cookie";
import Suspended from "./pages/Suspended";
const App = () => {
  
  const getToken = () => {
    const t =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token") ||
      Cookies.get("token");
  
    if (!t) return null;
    if (t === "null" || t === "undefined") return null;
    return t;
  };
  
  const token = Boolean(getToken());
  return (
    <BrowserRouter>
     <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        {/* Redirect root to dashboard */}
        <Route
  path="/"
  element={
    token
      ? <Navigate to="/dashboard" replace />
      : <Navigate to="/pricing" replace />
  }
/>



        {/* Public route */}
        <Route path="/login" element={<Login />} />
        <Route path="/lead-register" element={<LeadRegister/>} />
       <Route path="/forgot-password" element={<ForgotPassword />} />
       <Route path="/reset-password/:token" element={<ResetPassword />} />
       <Route path="/suspended" element={<Suspended />} />

        {/* Protected routes inside Layout */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts"
          element={
            <ProtectedRoute>
              <Layout>
                <ContactsTable />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <Layout>
                <ChangePassword />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/update-email"
          element={
            <ProtectedRoute>
              <Layout>
                <UpdateEmail/>
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/send"
          element={
            <ProtectedRoute>
              <Layout>
                <SendPanel />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute>
              <Layout>
                <UploadContacts />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
  path="/support"
  element={
    <ProtectedRoute>
      <Layout>
        <ContactSupport />
      </Layout>
    </ProtectedRoute>
  }
/>
<Route
  path="/pricing"
  element={
   
      <Layout>
        <Pricing />
      </Layout>
   
  }
/>
<Route
  path="/elastic"
  element={
    <ProtectedRoute>
      <Layout>
      <ElasticSearch/>
      </Layout>
    </ProtectedRoute>
  }
/>
        
<Route path="/register" element={<ProtectedRoute><Layout><Register /></Layout></ProtectedRoute>} />
<Route path="/add-pricing" element={<ProtectedRoute><Layout><PricingAdmin/></Layout></ProtectedRoute>} />

<Route path="/users" element={<ProtectedRoute><Layout><ManageUsers/></Layout></ProtectedRoute>} />
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
