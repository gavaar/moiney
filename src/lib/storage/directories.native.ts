import { Directory, Paths } from "expo-file-system";

// Shipped locations: changing these paths can orphan existing local data.
export const eventHistoryCacheDirectory = new Directory(Paths.cache, "moiney", "transactions");
export const pipeViewPreferencesDirectory = new Directory(Paths.document, "moiney", "pipe-views");
export const monthlyCardPreferencesDirectory = new Directory(Paths.document, "moiney", "monthly-card");
