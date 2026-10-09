import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ScrollToTop } from './components/ScrollToTop';
import { ChunkErrorBoundary } from './components/ChunkErrorBoundary';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import About from "./pages/About.tsx";
import CareerGuidance from "./pages/CareerGuidance.tsx";
import StaffingConsulting from "./pages/StaffingConsulting.tsx";
import SupplyChainPlanning from "./pages/SupplyChainPlanning.tsx";
import Guidewire from "./pages/Guidewire.tsx";
import Clients from "./pages/Clients.tsx";
import Contact from "./pages/Contact.tsx";
import Technology from "./pages/Technology.tsx";
import Careers from "./pages/Careers.tsx";
import NotFound from "./pages/NotFound.tsx";

const PortalApp = lazy(() => import("./portal/PortalApp"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      {/* Prominent, hard-to-miss toasts: top-center, colored by type (red for
          errors), with a close button and a longer dwell so users actually see
          API error reasons (e.g. a 403 on page load) instead of a 4s flash. */}
      <Sonner position="top-center" richColors closeButton duration={10000} />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <Routes>
          {/* Public marketing site */}
          <Route path="/" element={<Index />} />
          <Route path="/about" element={<About />} />
          <Route path="/career-guidance" element={<CareerGuidance />} />
          <Route path="/staffing-and-consulting" element={<StaffingConsulting />} />
          <Route path="/kinaxis" element={<SupplyChainPlanning />} />
          <Route path="/guidewire" element={<Guidewire />} />
          {/* The page shipped briefly at this path before being renamed to
              /kinaxis. Kept as a redirect so any link already shared still
              lands somewhere, rather than 404ing. */}
          <Route path="/supply-chain-planning" element={<Navigate to="/kinaxis" replace />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/technology" element={<Technology />} />
          <Route path="/careers" element={<Careers />} />

          {/* Workforce Management Portal */}
          <Route
            path="/portal/*"
            element={
              <ChunkErrorBoundary>
                <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-500">Loading portal...</div>}>
                  <PortalApp />
                </Suspense>
              </ChunkErrorBoundary>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
