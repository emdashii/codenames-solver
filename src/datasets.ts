import base from "../data/keycards.json";
import type { Dataset } from "./engine/types";

/** Key-card sets the app can solve against. Add other editions here. */
export const DATASETS: Dataset[] = [base as Dataset];
export const DEFAULT_DATASET = DATASETS[0]!;
