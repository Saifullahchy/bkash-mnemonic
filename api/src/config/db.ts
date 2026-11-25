import mongoose from "mongoose";
import { isProduction } from "./env.js";
import { logger } from "./logger.js";

mongoose.set("strictQuery", true);

/**
 * Connects Mongoose. In production indexes are NOT auto-built on boot (that can
 * lock large collections); they are created by a deploy step (`syncIndexes`).
 */
export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
  mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));
  mongoose.connection.on("error", (error) => logger.error({ err: error }, "MongoDB error"));

  const connection = await mongoose.connect(uri, {
    autoIndex: !isProduction,
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10_000,
  });
  logger.info({ db: connection.connection.name }, "MongoDB connected");
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
