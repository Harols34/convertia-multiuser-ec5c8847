import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Personnel from "./pages/Personnel";
import BulkPersonnel from "./pages/BulkPersonnel";
import BulkEdit from "./pages/BulkEdit";
import BulkPaste from "./pages/BulkPaste";
import Applications from "./pages/Applications";
import ApplicationCredentials from "./pages/ApplicationCredentials";
import HelpDesk from "./pages/HelpDesk";
import UserPortal from "./pages/UserPortal";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Home público - Portal de acceso para usuarios */}
            <Route path="/" element={<Home />} />
            
            {/* Autenticación */}
            <Route path="/auth" element={<Auth />} />
            
            {/* Portal público de usuarios (sin autenticación) */}
            <Route path="/busca-tu-info" element={<UserPortal />} />
            
            {/* Rutas protegidas del administrador */}
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
              path="/companies"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Companies />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/personnel"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Personnel />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bulk-personnel"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BulkPersonnel />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bulk-paste"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BulkPaste />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bulk-edit"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BulkEdit />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/applications"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Applications />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/application-credentials"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ApplicationCredentials />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/help-desk"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HelpDesk />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Reports />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
