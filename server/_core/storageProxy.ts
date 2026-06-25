import express, { type Express } from "express";
import { getStorageRoot } from "../storage";

export function registerStorageProxy(app: Express) {
  app.use(
    "/storage",
    express.static(getStorageRoot(), {
      fallthrough: false,
      immutable: false,
      maxAge: 0,
    })
  );
}
