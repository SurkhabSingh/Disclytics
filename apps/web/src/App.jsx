import { QueryClientProvider } from "@tanstack/react-query";

import { appQueryClient } from "./api/queryClient";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { DashboardPage } from "./pages/DashboardPage";

export default function App() {
  return (
    <QueryClientProvider client={appQueryClient}>
      <AppErrorBoundary>
        <DashboardPage />
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}
