import { createContext, useContext, type ReactNode } from "react";
import { useCurrentMonthReport } from "./useCurrentMonthReport";

type CurrentMonthReportValue = ReturnType<typeof useCurrentMonthReport>;

const CurrentMonthReportContext = createContext<CurrentMonthReportValue | null>(null);

export function CurrentMonthReportProvider({ children }: { children: ReactNode }) {
  const value = useCurrentMonthReport();
  return <CurrentMonthReportContext.Provider value={value}>{children}</CurrentMonthReportContext.Provider>;
}

export function useCurrentMonthReportContext(): CurrentMonthReportValue {
  const value = useContext(CurrentMonthReportContext);
  if (!value) throw new Error("useCurrentMonthReportContext must be used within CurrentMonthReportProvider");
  return value;
}
