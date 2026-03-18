import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import About from "./pages/About.tsx";
import CareerGuidance from "./pages/CareerGuidance.tsx";
import StaffingConsulting from "./pages/StaffingConsulting.tsx";
import SoftwareTraining from "./pages/SoftwareTraining.tsx";
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
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public marketing site */}
          <Route path="/" element={<Index />} />
          <Route path="/about" element={<About />} />
          <Route path="/career-guidance" element={<CareerGuidance />} />
          <Route path="/staffing-and-consulting" element={<StaffingConsulting />} />
          <Route path="/software-training" element={<SoftwareTraining />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/technology" element={<Technology />} />
          <Route path="/careers" element={<Careers />} />

          {/* Workforce Management Portal */}
          <Route
            path="/portal/*"
            element={
              <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-500">Loading portal...</div>}>
                <PortalApp />
              </Suspense>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
