import cors from "cors";
import express, { type Request, type Response } from "express";
import { registerAdminRoutes } from "./routes/admin";
import { registerAuditRoutes } from "./routes/audit";
import { registerAuthRoutes } from "./routes/auth";
import { registerFavoriteRoutes } from "./routes/favorites";
import { registerIssueRoutes } from "./routes/issues";
import { registerOperatorRoutes } from "./routes/operator";
import { registerReportRoutes } from "./routes/reports";
import { registerReservationRoutes } from "./routes/reservations";
import { registerSecurityRoutes } from "./routes/security";
import { registerSessionRoutes } from "./routes/sessions";
import { registerSystemRoutes } from "./routes/system";
import { registerVehicleRoutes } from "./routes/vehicles";
import { registerWalletRoutes } from "./routes/wallet";
import { toApiValue } from "./services/core";

export const app = express();

app.use(cors());
app.use(express.json());
app.use((_req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body: unknown) => json(toApiValue(body));
  next();
});

registerSystemRoutes(app);
registerVehicleRoutes(app);
registerReservationRoutes(app);
registerSessionRoutes(app);
registerWalletRoutes(app);
registerIssueRoutes(app);
registerFavoriteRoutes(app);
registerOperatorRoutes(app);
registerReportRoutes(app);
registerAdminRoutes(app);
registerSecurityRoutes(app);
registerAuditRoutes(app);
registerAuthRoutes(app);

app.use((error: unknown, _req: Request, res: Response, _next: () => void) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error", detail: error instanceof Error ? error.message : String(error) });
});
