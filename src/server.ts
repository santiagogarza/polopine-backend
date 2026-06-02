import { app } from "./app.js";
import { seed } from "./store.js";

const port = Number(process.env.PORT) || 8080;

seed();

app.listen(port, "0.0.0.0", () => {
  console.log(`polopine-backend listening on port ${port}`);
});
