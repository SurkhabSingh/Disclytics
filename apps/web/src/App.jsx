import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { DashboardPage } from "./pages/DashboardPage";

export default function App() {
  return (
    <AppErrorBoundary>
      <DashboardPage />
    </AppErrorBoundary>
  );
}
