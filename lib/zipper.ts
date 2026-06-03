// @ts-ignore
import { ZipArchive } from "archiver";
import { Readable } from "stream";
import fs from "fs";
import path from "path";

export interface ZipEntry {
  filePath: string;
  zipName: string;
}

export async function createMp3Zip(entries: ZipEntry[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const archive = new ZipArchive({
      zlib: { level: 6 }, // Good compression without being too slow
    });

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("error", reject);
    archive.on("end", () => resolve(Buffer.concat(chunks)));

    for (const entry of entries) {
      if (fs.existsSync(entry.filePath)) {
        archive.file(entry.filePath, { name: entry.zipName });
      }
    }

    archive.finalize();
  });
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 100);
}
