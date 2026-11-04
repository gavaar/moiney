import { AppTabs } from "@features/app/AppTabs/AppTabs";
import { PipeCatalogProvider } from "@features/pipes/context/PipeCatalogContext";
import { CurrentMonthReportProvider } from "@features/statistics/CurrentMonthReportContext";

export default function TabLayout() {
  return (
    <PipeCatalogProvider>
      <CurrentMonthReportProvider>
        <AppTabs />
      </CurrentMonthReportProvider>
    </PipeCatalogProvider>
  );
}
