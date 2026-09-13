import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { generalRateLimiter } from "./middleware/rateLimiters";

export const app = express();

// --- Security headers ---
app.use(helmet());

// --- CORS: only the known frontend origin, with credentials for the
//     httpOnly refresh-token cookie ---
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(pinoHttp({ redact: ["req.headers.authorization", "req.headers.cookie"] }));

app.use(generalRateLimiter);

app.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
