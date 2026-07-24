import { useContext } from "react";
import { AlertContext } from "./AlertProvider";

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlert must be used within an AlertProvider");
  return ctx.showAlert;
}