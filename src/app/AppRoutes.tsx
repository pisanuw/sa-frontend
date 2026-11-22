import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import ProtectedRoute from "../components/ProtectedRoute";

// Public pages
import Home from "../pages/Home";
import About from "../pages/About";
import Charts from "../pages/Charts";
import ChartPermalinkPage from "../pages/ChartPermalinkPage";
import AltTextGuidancePage from "../pages/Guidance";
import AuthPage from "../pages/AuthPage";
import AuthCallback from "../pages/AuthCallback";
import LD from "../pages/LD";
import PublicFlowchart from "../pages/PublicFlowchart";
import PublicFlowchartJsonPage from "../pages/PublicFlowchartJsonPage";
import PublicRepoPage from "../pages/PublicRepoPage";

// Private pages
import Dashboard from "../pages/Dashboard";
import AccountPage from "../pages/AccountPage";
import CreatePage from "../pages/CreatePage";
import SlideDeckUploadPage from "../pages/SlideDeckUploadPage";
import SlideDeckResultsPage from "../pages/SlideDeckResultsPage";
import DiagramEditorPage from "../pages/DiagramEditorPage";
import TryPage from "../pages/TryPage";
import PermalinkContent from "../components/access-reps/PermalinkContent";
import PermalinkJsonPage from "../components/access-reps/PermalinkJsonPage";

// Grafari
import GrafariPlaygroundPage from "../grafari/pages/GrafariPlaygroundPage";
import VizResultsPage from "../grafari/pages/VizResultsPage";

// Longdesc viewer
import LongDescViewer from "../components/longdesc/LongDescViewer";


const RequireAuth = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/charts" element={<Charts />} />
      <Route path="/charts/:slug" element={<ChartPermalinkPage />} />
      <Route path="/guidance" element={<AltTextGuidancePage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/browse" element={<PublicRepoPage />} />
      <Route path="/try" element={<TryPage />} />
      <Route path="/examples" element={<Navigate to="/browse" replace />} />

      {/* Grafari (public for now) */}
      <Route path="/grafari" element={<GrafariPlaygroundPage />} />
      <Route path="/viz/:id" element={<VizResultsPage />} />

      {/* Long description permalinks (public) */}
      <Route path="/ld" element={<LD />} />
      <Route path="/ld/:slug" element={<LongDescViewer />} />

      {/* Public published flowchart permalink */}
      <Route path="/p/:public_slug" element={<PublicFlowchart />} />
      <Route path="/p/:public_slug/json" element={<PublicFlowchartJsonPage />} />

      {/* Private (auth required) */}
      <Route
        path="/decks/new"
        element={<RequireAuth><SlideDeckUploadPage /></RequireAuth>}
      />
      <Route
        path="/decks/:deckId"
        element={<RequireAuth><SlideDeckResultsPage /></RequireAuth>}
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/account"
        element={
          <RequireAuth>
            <AccountPage />
          </RequireAuth>
        }
      />
      <Route path="/upload" element={<Navigate to="/create" replace />} />
      <Route path="/create/markdown" element={<Navigate to="/create" replace />} />
      <Route
        path="/create"
        element={
          <RequireAuth>
            <CreatePage />
          </RequireAuth>
        }
      />
      <Route
        path="/editor"
        element={
          <RequireAuth>
            <DiagramEditorPage />
          </RequireAuth>
        }
      />
      <Route
        path="/editor/:id"
        element={
          <RequireAuth>
            <DiagramEditorPage />
          </RequireAuth>
        }
      />
      <Route
        path="/flowchart/:id"
        element={
          <RequireAuth>
            <PermalinkContent />
          </RequireAuth>
        }
      />
      <Route
        path="/flowchart/:id/json"
        element={
          <RequireAuth>
            <PermalinkJsonPage />
          </RequireAuth>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function NotFound() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <p>
        Go back to <a href="/">Home</a>.
      </p>
    </div>
  );
}
