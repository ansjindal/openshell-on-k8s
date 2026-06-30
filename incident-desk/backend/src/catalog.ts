import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface Product {
  id: string;
  name: string;
  focus: string;
  seedUrls: string[];
}
export interface Catalog {
  event: string;
  description?: string;
  products: Product[];
}

const CATALOG_DIR = process.env.CATALOG_DIR ?? join(process.cwd(), "..", "catalog");

export function listEvents(): { file: string; event: string; products: number }[] {
  return readdirSync(CATALOG_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const c = loadCatalogFile(f);
      return { file: f, event: c.event, products: c.products.length };
    });
}

export function loadCatalogFile(file: string): Catalog {
  return JSON.parse(readFileSync(join(CATALOG_DIR, file), "utf8")) as Catalog;
}

/** Load a catalog by its `event` name (case-insensitive) or filename. */
export function loadCatalog(eventOrFile: string): Catalog {
  if (eventOrFile.endsWith(".json")) return loadCatalogFile(eventOrFile);
  for (const e of listEvents()) {
    if (e.event.toLowerCase() === eventOrFile.toLowerCase()) return loadCatalogFile(e.file);
  }
  throw new Error(`unknown event: ${eventOrFile}`);
}
