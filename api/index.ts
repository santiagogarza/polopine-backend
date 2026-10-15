import { app } from "../src/app.js";
import { seed } from "../src/store.js";

// Seed on every cold start so the demo polls always exist.
seed();

export default app;
