import path from "node:path";
import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { ENV } from "./_core/env";

export function getStorageRoot() {
  return path.resolve(process.cwd(), ENV.storageDir);
}

function normalizeKey(relKey: string): string {
  return relKey
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter(part => part && part !== "." && part !== "..")
    .join("/");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  void contentType;

  const key = appendHashSuffix(normalizeKey(relKey));
  const fullPath = path.resolve(getStorageRoot(), key);
  const relative = path.relative(getStorageRoot(), fullPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Invalid storage key");
  }

  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, data);

  return { key, url: `/storage/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { url } = await storageGet(relKey);
  return url;
}
