import ExcelJS from "exceljs";
import whatsappIconUrl from "../assets/whatsapp-icon.png";

/** Shared row shape for mock now / real results later. */
export interface FacebookExcelExportRow {
  id: number;
  name: string;
  profileUrl: string;
  /** Facebook author avatar / profile image URL when available. */
  avatarUrl?: string | null;
  comment: string;
  phone: string;
  status: string;
  updated: string;
}

const COLORS = {
  headerBg: "FF2563EB",
  headerFg: "FFFFFFFF",
  text: "FF0F172A",
  secondary: "FF64748B",
  border: "FFE2E8F0",
  white: "FFFFFFFF",
  altRow: "FFF8FAFC",
  link: "FF2563EB",
  completedBg: "FFDCFCE7",
  completedFg: "FF16A34A",
  runningBg: "FFFFF7ED",
  runningFg: "FFF97316",
  pendingBg: "FFF1F5F9",
  pendingFg: "FF64748B",
  failedBg: "FFFEE2E2",
  failedFg: "FFDC2626",
} as const;

const AVATAR_FETCH_TIMEOUT_MS = 8000;
const AVATAR_CONCURRENCY = 6;
const AVATAR_DISPLAY_PX = 32;

type ImageExt = "png" | "jpeg";

type LoadedAvatar = {
  base64: string;
  extension: ImageExt;
};

type AvatarFetchFailure = {
  url: string;
  reason: string;
};

function statusColors(status: string): { bg: string; fg: string } {
  switch (String(status || "").toLowerCase()) {
    case "completed":
      return { bg: COLORS.completedBg, fg: COLORS.completedFg };
    case "running":
      return { bg: COLORS.runningBg, fg: COLORS.runningFg };
    case "failed":
      return { bg: COLORS.failedBg, fg: COLORS.failedFg };
    case "pending":
    default:
      return { bg: COLORS.pendingBg, fg: COLORS.pendingFg };
  }
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const edge: Partial<ExcelJS.Border> = {
    style: "thin",
    color: { argb: COLORS.border },
  };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function bytesToBase64(buf: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    const slice = buf.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(
      null,
      Array.from(slice) as unknown as number[]
    );
  }
  return btoa(binary);
}

function detectImageExtension(
  contentType: string | null,
  bytes: Uint8Array
): ImageExt | null {
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpeg";

  // Magic bytes
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  return null;
}

async function fetchAvatarImage(
  url: string
): Promise<{ ok: true; data: LoadedAvatar } | { ok: false; reason: string }> {
  const trimmed = String(url || "").trim();
  if (!trimmed) return { ok: false, reason: "empty_url" };

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), AVATAR_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(trimmed, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}` };
    }
    const contentType = res.headers.get("content-type");
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.length) return { ok: false, reason: "empty_body" };

    const extension = detectImageExtension(contentType, buf);
    if (!extension) {
      return {
        ok: false,
        reason: `unsupported_format:${contentType || "unknown"}`,
      };
    }

    return {
      ok: true,
      data: { base64: bytesToBase64(buf), extension },
    };
  } catch (err: unknown) {
    const name = err && typeof err === "object" && "name" in err ? String((err as { name?: string }).name) : "";
    const message = err instanceof Error ? err.message : String(err);
    if (name === "AbortError") return { ok: false, reason: "timeout" };
    // Browser CORS failures typically surface as TypeError: Failed to fetch
    if (/failed to fetch|networkerror|cors/i.test(message)) {
      return { ok: false, reason: `cors_or_network:${message}` };
    }
    return { ok: false, reason: `error:${message}` };
  } finally {
    window.clearTimeout(timer);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => run());
  await Promise.all(runners);
  return results;
}

async function loadAvatarsForRows(
  results: FacebookExcelExportRow[]
): Promise<{
  byIndex: Array<LoadedAvatar | null>;
  attempted: number;
  embedded: number;
  failed: number;
  failures: AvatarFetchFailure[];
}> {
  const urls = results.map((r) => String(r.avatarUrl || "").trim());
  const uniqueUrls = [...new Set(urls.filter(Boolean))];
  const cache = new Map<string, LoadedAvatar | null>();
  const failures: AvatarFetchFailure[] = [];

  await mapWithConcurrency(uniqueUrls, AVATAR_CONCURRENCY, async (url) => {
    const result = await fetchAvatarImage(url);
    if (result.ok) {
      cache.set(url, result.data);
    } else {
      cache.set(url, null);
      failures.push({ url, reason: result.reason });
    }
    return null;
  });

  const byIndex = urls.map((url) => (url ? cache.get(url) ?? null : null));
  const embedded = byIndex.filter(Boolean).length;
  const attempted = urls.filter(Boolean).length;
  const failed = attempted - embedded;

  return { byIndex, attempted, embedded, failed, failures };
}

async function loadLocalWhatsappPngBase64(): Promise<string | null> {
  try {
    const res = await fetch(whatsappIconUrl);
    if (!res.ok) return null;
    return bytesToBase64(new Uint8Array(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type FacebookExcelExportMeta = {
  rowsExported: number;
  whatsappIconEmbedded: boolean;
  imageSourceField: "avatarUrl";
  imagesAttempted: number;
  imagesEmbedded: number;
  imagesFailed: number;
  failureReasons: string[];
  profileImageEmbedded: "YES" | "NO" | "SKIPPED SAFELY";
  likelyCorsBlocked: boolean;
};

/**
 * Build and download a styled Extraction Results workbook.
 * Accepts mock or future real rows with the same shape.
 */
export async function exportFacebookResultsExcel(
  results: FacebookExcelExportRow[],
  filename = "Facebook_Posts_Extraction_Results.xlsx"
): Promise<FacebookExcelExportMeta> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Profile SMS";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("Extraction Results", {
    views: [{ state: "frozen", ySplit: 1, activeCell: "A2" }],
  });

  ws.columns = [
    { header: "#", key: "num", width: 6 },
    { header: "User", key: "user", width: 28 },
    { header: "Facebook Profile", key: "profile", width: 36 },
    { header: "Comment", key: "comment", width: 50 },
    { header: "Phone Number", key: "phone", width: 20 },
    { header: "Status", key: "status", width: 14 },
    { header: "Updated", key: "updated", width: 16 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.headerBg },
    };
    cell.font = {
      bold: true,
      color: { argb: COLORS.headerFg },
      size: 11,
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: false,
    };
    cell.border = thinBorder() as ExcelJS.Borders;
  });

  // Prefetch avatars (bounded concurrency). Failures never abort export.
  const avatarStats = await loadAvatarsForRows(results);

  const whatsappPngBase64 = await loadLocalWhatsappPngBase64();
  let whatsappImageId: number | null = null;
  if (whatsappPngBase64) {
    whatsappImageId = workbook.addImage({
      base64: whatsappPngBase64,
      extension: "png",
    });
  }

  // Deduplicate workbook images by base64 for identical avatars
  const imageIdByKey = new Map<string, number>();
  function getOrAddAvatarImage(avatar: LoadedAvatar): number {
    const key = `${avatar.extension}:${avatar.base64.slice(0, 64)}:${avatar.base64.length}`;
    const existing = imageIdByKey.get(key);
    if (existing != null) return existing;
    const id = workbook.addImage({
      base64: avatar.base64,
      extension: avatar.extension,
    });
    imageIdByKey.set(key, id);
    return id;
  }

  results.forEach((row, index) => {
    const excelRowIndex = index + 2; // 1-based with header
    const excelRow = ws.getRow(excelRowIndex);
    const alt = index % 2 === 1;
    const rowFill = alt ? COLORS.altRow : COLORS.white;
    const st = statusColors(row.status);
    const avatar = avatarStats.byIndex[index];

    const commentLen = String(row.comment || "").length;
    const commentHeight = Math.min(72, Math.max(22, Math.ceil(commentLen / 55) * 15));
    excelRow.height = Math.max(commentHeight, avatar ? 38 : 22);

    // #
    const cNum = excelRow.getCell(1);
    cNum.value = index + 1;
    cNum.font = { color: { argb: COLORS.secondary }, size: 10 };
    cNum.alignment = { vertical: "middle", horizontal: "center" };

    // User: name + optional embedded avatar on the left of the same column
    const cUser = excelRow.getCell(2);
    cUser.value = row.name;
    cUser.font = { color: { argb: COLORS.text }, size: 11, bold: true };
    cUser.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: false,
      indent: avatar ? 5 : 0,
    };

    if (avatar) {
      try {
        const imgId = getOrAddAvatarImage(avatar);
        ws.addImage(imgId, {
          tl: { col: 1 + 0.1, row: excelRowIndex - 1 + 0.18 },
          ext: { width: AVATAR_DISPLAY_PX, height: AVATAR_DISPLAY_PX },
          editAs: "oneCell",
        });
      } catch {
        // Ignore single-image embed errors; keep name/text row.
      }
    }

    // Facebook Profile (hyperlink)
    const cProfile = excelRow.getCell(3);
    const profileUrl = String(row.profileUrl || "").trim();
    if (profileUrl) {
      cProfile.value = { text: profileUrl, hyperlink: profileUrl };
      cProfile.font = {
        color: { argb: COLORS.link },
        underline: true,
        size: 10,
      };
    } else {
      cProfile.value = "";
    }
    cProfile.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: false,
    };

    // Comment (full text + wrap)
    const cComment = excelRow.getCell(4);
    cComment.value = row.comment ?? "";
    cComment.font = { color: { argb: COLORS.text }, size: 10 };
    cComment.alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };

    // Phone as TEXT + local WhatsApp icon
    const cPhone = excelRow.getCell(5);
    cPhone.value = String(row.phone ?? "");
    cPhone.numFmt = "@";
    cPhone.font = { color: { argb: COLORS.text }, size: 10 };
    cPhone.alignment = {
      vertical: "middle",
      horizontal: "left",
      indent: whatsappImageId != null ? 2 : 0,
    };

    if (whatsappImageId != null) {
      ws.addImage(whatsappImageId, {
        tl: { col: 4 + 0.08, row: excelRowIndex - 1 + 0.22 },
        ext: { width: 14, height: 14 },
        editAs: "oneCell",
      });
    }

    // Status
    const cStatus = excelRow.getCell(6);
    cStatus.value =
      String(row.status || "").charAt(0).toUpperCase() +
      String(row.status || "").slice(1).toLowerCase();
    cStatus.font = { bold: true, color: { argb: st.fg }, size: 10 };
    cStatus.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: st.bg },
    };
    cStatus.alignment = { vertical: "middle", horizontal: "center" };

    // Updated
    const cUpdated = excelRow.getCell(7);
    cUpdated.value = row.updated ?? "";
    cUpdated.font = { color: { argb: COLORS.secondary }, size: 10 };
    cUpdated.alignment = { vertical: "middle", horizontal: "left" };

    for (let col = 1; col <= 7; col++) {
      const cell = excelRow.getCell(col);
      cell.border = thinBorder() as ExcelJS.Borders;
      if (col !== 6) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: rowFill },
        };
      }
    }
  });

  const lastDataRow = Math.max(1, results.length + 1);
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: lastDataRow, column: 7 },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);

  const corsHits = avatarStats.failures.filter((f) =>
    /cors/i.test(f.reason)
  ).length;
  const likelyCorsBlocked =
    avatarStats.attempted > 0 &&
    avatarStats.embedded === 0 &&
    (corsHits > 0 ||
      avatarStats.failures.every((f) =>
        /cors_or_network|failed to fetch/i.test(f.reason)
      ));

  const reasonSummary = [
    ...new Set(avatarStats.failures.map((f) => f.reason)),
  ].slice(0, 8);

  return {
    rowsExported: results.length,
    whatsappIconEmbedded: whatsappImageId != null,
    imageSourceField: "avatarUrl",
    imagesAttempted: avatarStats.attempted,
    imagesEmbedded: avatarStats.embedded,
    imagesFailed: avatarStats.failed,
    failureReasons: reasonSummary,
    profileImageEmbedded:
      avatarStats.embedded > 0
        ? "YES"
        : avatarStats.attempted > 0
          ? "NO"
          : "SKIPPED SAFELY",
    likelyCorsBlocked,
  };
}
