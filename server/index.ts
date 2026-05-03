import { app } from "./app";

const port = Number(process.env.PORT ?? 4000);

app.listen(port, "127.0.0.1", () => {
  console.log(`Group28 EV Charging API running at http://127.0.0.1:${port}`);
});
