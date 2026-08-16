/**
 * Phase 1B — Real TXT upload + create queued Batch UI.
 * Same visual design as the Extraction Results mock screen.
 * No v73 / extension communication.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Download, ExternalLink, Facebook, Upload } from "lucide-react";
import axios from "axios";
import {
  createFacebookPostBatch,
  getFacebookPostBatch,
  listFacebookPostBatches,
  requestFacebookPostBatchHandoff,
} from "../api";
import {
  BATCH_RESULTS_PAGE_SIZE,
  MAX_TXT_BYTES,
  isTxtFile,
  parseFacebookLinksTxt,
  pickActiveBatch,
  validateBeforeCreateBatch,
  type FacebookPostBatchSummary,
} from "../utils/facebookPostBatchTxt";
import {
  MOCK_EXTRACTION_RESULTS,
  USE_MOCK_EXTRACTION_RESULTS,
  type MockExtractionResult,
  type MockExtractionStatus,
} from "../utils/facebookPostsMockData";
import { exportFacebookResultsExcel } from "../utils/exportFacebookResultsExcel";
import { handoffBatchToV73Extension } from "../utils/profileSmsV73Handoff";

const THEME = {
  pageBg: "#F8FAFC",
  cardBg: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  secondary: "#64748B",
  primary: "#2563EB",
  primaryHover: "#1D4ED8",
  headerBg: "#F8FAFC",
} as const;

function statusStyles(status: string): { background: string; color: string } {
  switch (status) {
    case "completed":
      return { background: "#DCFCE7", color: "#16A34A" };
    case "running":
      return { background: "#FFF7ED", color: "#F97316" };
    case "failed":
      return { background: "#FEE2E2", color: "#DC2626" };
    case "queued":
      return { background: "#DBEAFE", color: "#2563EB" };
    case "partial":
      return { background: "#FEF3C7", color: "#D97706" };
    case "pending":
    default:
      return { background: "#F1F5F9", color: "#64748B" };
  }
}

function mockStatusStyles(status: MockExtractionStatus) {
  return statusStyles(status);
}

function WhatsAppIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="#25D366"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="shrink-0"
    >
      <title>WhatsApp</title>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export function FacebookPostsBatchUI() {
  const useMock = USE_MOCK_EXTRACTION_RESULTS;

  const [commentsPerPost, setCommentsPerPost] = useState("100");
  const [page, setPage] = useState(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedLinks, setParsedLinks] = useState<string[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeBatch, setActiveBatch] = useState<FacebookPostBatchSummary | null>(
    null
  );
  /** Real mode results are always empty until later ingestion phases. */
  const [resultRows, setResultRows] = useState<MockExtractionResult[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const submitLockRef = useRef(false);
  const mounted = useRef(true);

  const displayRows = useMock ? MOCK_EXTRACTION_RESULTS : resultRows;
  const total = displayRows.length;
  const totalPages = Math.max(1, Math.ceil(total / BATCH_RESULTS_PAGE_SIZE) || 1);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const restoreOwnBatch = useCallback(async () => {
    if (useMock) return;
    try {
      const data = await listFacebookPostBatches();
      if (!mounted.current) return;
      const batches: FacebookPostBatchSummary[] = Array.isArray(data?.batches)
        ? data.batches.map((b: Record<string, unknown>) => ({
            batch_id: Number(b.batch_id),
            status: String(b.status || ""),
            total_links: Number(b.total_links || 0),
            requested_count: Number(b.requested_count || 0),
            created_at: (b.created_at as string) || null,
            updated_at: (b.updated_at as string) || null,
          }))
        : [];
      const picked = pickActiveBatch(batches);
      setActiveBatch(picked);
      if (picked?.batch_id) {
        try {
          const detail = await getFacebookPostBatch(picked.batch_id);
          if (!mounted.current) return;
          const batch = detail?.batch;
          if (batch) {
            setActiveBatch({
              batch_id: Number(batch.batch_id),
              status: String(batch.status || picked.status),
              total_links: Number(batch.total_links || picked.total_links),
              requested_count: Number(
                batch.requested_count || picked.requested_count
              ),
              created_at: batch.created_at || null,
              updated_at: batch.updated_at || null,
            });
          }
        } catch {
          /* list data is enough */
        }
      }
    } catch {
      /* keep local state on refresh failure */
    }
  }, [useMock]);

  useEffect(() => {
    restoreOwnBatch();
  }, [restoreOwnBatch]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * BATCH_RESULTS_PAGE_SIZE;
    return displayRows.slice(start, start + BATCH_RESULTS_PAGE_SIZE);
  }, [page, displayRows]);

  const rangeStart = total === 0 ? 0 : (page - 1) * BATCH_RESULTS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * BATCH_RESULTS_PAGE_SIZE, total);

  const pageNumbers = useMemo(() => {
    if (total === 0) return [] as number[];
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }, [totalPages, total]);

  const applyFile = async (file: File | null | undefined) => {
    if (!file) return;

    if (useMock) {
      toast("Mock mode — file upload is UI only.", { icon: "🎨" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (!isTxtFile(file)) {
      setFileError("Only .txt files are allowed.");
      toast.error("Only .txt files are allowed.");
      // Keep prior valid selection
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_TXT_BYTES) {
      setFileError("File exceeds maximum size of 5MB.");
      toast.error("File exceeds maximum size of 5MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseFacebookLinksTxt(text);
      if (!parsed.ok) {
        setFileError(parsed.error);
        toast.error(parsed.error);
        // Invalid file must not wipe a prior valid selection or touch server batch
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setFileName(file.name);
      setParsedLinks(parsed.links);
      setFileError(null);
    } catch {
      setFileError("Could not read the selected file.");
      toast.error("Could not read the selected file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearVisibleResults = () => {
    setResultRows([]);
    setPage(1);
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();

    if (useMock) {
      toast("Mock mode — Start Extraction is UI only (no API).", { icon: "🎨" });
      return;
    }

    if (submitLockRef.current || submitting) return;

    const gate = validateBeforeCreateBatch(
      parsedLinks,
      commentsPerPost,
      Boolean(fileName)
    );
    if (!gate.ok) {
      toast.error(gate.error);
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const data = await createFacebookPostBatch({
        links: gate.links,
        requested_count: gate.requested_count,
      });

      if (!mounted.current) return;

      const batch: FacebookPostBatchSummary = {
        batch_id: Number(data.batch_id),
        status: String(data.status || "queued"),
        total_links: Number(data.total_links || gate.links.length),
        requested_count: Number(
          data.requested_count || gate.requested_count
        ),
      };
      setActiveBatch(batch);
      clearVisibleResults();
      if (batch.status === "queued") {
        toast.success("Extraction queued successfully.");
      } else {
        toast.success(`Batch created — ${batch.status}.`);
      }

      // Phase 1C: request batch-scoped handoff token and notify v73 bridge.
      // Never send user_id / password / main JWT. Failure must not corrupt UI.
      try {
        const handoff = await requestFacebookPostBatchHandoff(batch.batch_id);
        const token = handoff?.handoff_token;
        if (token) {
          const delivered = await handoffBatchToV73Extension({
            batch_id: batch.batch_id,
            handoff_token: String(token),
            requested_count: batch.requested_count,
            total_links: batch.total_links,
            status: batch.status,
          });
          if (!delivered.ok) {
            // Extension may be unloaded — batch remains queued on server.
            console.info(
              "[ProfileSMS] v73 handoff bridge unavailable:",
              delivered.error
            );
          }
        }
      } catch (handoffErr) {
        console.info("[ProfileSMS] handoff token request failed:", handoffErr);
      }
    } catch (err) {
      if (!mounted.current) return;
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const apiErr =
          (err.response?.data as { error?: string } | undefined)?.error ||
          err.message;
        if (status === 409) {
          toast.error(
            apiErr || "You already have an extraction in progress."
          );
        } else {
          toast.error(apiErr || "Failed to create extraction batch.");
        }
      } else {
        toast.error("Failed to create extraction batch.");
      }
      // Do not clear file selection on failure
    } finally {
      submitLockRef.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };

  const handleExportExcel = async () => {
    if (total === 0) {
      toast.error("No results to export.");
      return;
    }
    try {
      const meta = await exportFacebookResultsExcel(
        displayRows.map((r) => ({
          id: r.id,
          name: r.name,
          profileUrl: r.profileUrl,
          avatarUrl: r.avatarUrl,
          comment: r.comment,
          phone: r.phone,
          status: r.status,
          updated: r.updated,
        })),
        "Facebook_Posts_Extraction_Results.xlsx"
      );
      if (meta.likelyCorsBlocked) {
        toast.error(
          `Excel exported, but profile images blocked (CORS/network). Embedded ${meta.imagesEmbedded}/${meta.imagesAttempted}.`
        );
      } else if (meta.imagesFailed > 0) {
        toast.success(
          `Exported ${meta.rowsExported} rows. Images: ${meta.imagesEmbedded}/${meta.imagesAttempted} embedded.`
        );
      } else {
        toast.success(
          `Exported ${meta.rowsExported} results to Excel${
            meta.imagesEmbedded > 0
              ? ` (${meta.imagesEmbedded} profile images)`
              : ""
          }.`
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to export Excel file.");
    }
  };

  const linkPreview =
    !useMock && fileName && parsedLinks.length > 0
      ? `${parsedLinks.length} valid link${
          parsedLinks.length === 1 ? "" : "s"
        } selected`
      : null;

  const batchInfo =
    !useMock && activeBatch
      ? `${activeBatch.total_links} link${
          activeBatch.total_links === 1 ? "" : "s"
        } ${activeBatch.status === "queued" ? "queued" : activeBatch.status}`
      : null;

  return (
    <div
      className="min-h-screen px-4 sm:px-8 py-8 transition-all duration-300"
      style={{ background: THEME.pageBg, color: THEME.text }}
    >
      <motion.h1
        className="text-2xl sm:text-3xl font-bold mb-8 tracking-tight flex items-center gap-3"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Facebook size={28} style={{ color: THEME.primary }} />
        Facebook Posts
      </motion.h1>

      <motion.form
        onSubmit={handleStart}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border shadow-sm p-5 sm:p-6 mb-8 max-w-7xl mx-auto"
        style={{
          background: THEME.cardBg,
          borderColor: THEME.border,
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7">
            <label
              className="block text-sm font-semibold mb-2"
              style={{ color: THEME.text }}
            >
              Upload Links File (TXT)
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const f = e.dataTransfer.files?.[0];
                void applyFile(f);
              }}
              className="w-full rounded-xl border-2 border-dashed px-6 py-10 text-center transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              style={{
                borderColor: THEME.border,
                background: THEME.cardBg,
              }}
            >
              <Upload
                className="mx-auto mb-3"
                size={28}
                style={{ color: THEME.primary }}
              />
              <div
                className="text-sm font-medium"
                style={{ color: THEME.text }}
              >
                Click to upload or drag & drop
              </div>
              <div
                className="text-sm mt-1"
                style={{ color: THEME.secondary }}
              >
                .txt file with Facebook post links (one per line)
              </div>
              <div
                className="text-xs mt-3"
                style={{ color: THEME.secondary }}
              >
                Max file size: 5MB
              </div>
              {fileName && (
                <div
                  className="text-sm mt-4 font-medium"
                  style={{ color: THEME.text }}
                >
                  {fileName}
                </div>
              )}
              {linkPreview && (
                <div
                  className="text-sm mt-1 font-semibold"
                  style={{ color: THEME.primary }}
                >
                  {linkPreview}
                </div>
              )}
              {fileError && (
                <div className="text-xs mt-2 text-red-600">{fileError}</div>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                void applyFile(f);
              }}
            />
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">
            <div>
              <label
                className="block text-sm font-semibold mb-2"
                style={{ color: THEME.text }}
              >
                Number of Comments per Post
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={commentsPerPost}
                onChange={(e) => setCommentsPerPost(e.target.value)}
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/40"
                style={{
                  borderColor: THEME.border,
                  color: THEME.text,
                  background: THEME.cardBg,
                }}
              />
              <p
                className="text-xs mt-2"
                style={{ color: THEME.secondary }}
              >
                How many comments to extract from each post
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-white text-sm font-medium transition disabled:opacity-60"
                style={{ background: THEME.primary }}
                onMouseEnter={(e) => {
                  if (!submitting) {
                    e.currentTarget.style.background = THEME.primaryHover;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = THEME.primary;
                }}
              >
                {submitting ? "Queuing…" : "Start Extraction"}
              </button>
              {batchInfo && (
                <div
                  className="mt-3 rounded-lg border px-3 py-2.5 text-xs leading-relaxed flex flex-wrap items-center gap-2"
                  style={{
                    borderColor: THEME.border,
                    background: "#EFF6FF",
                    color: THEME.text,
                  }}
                >
                  <span
                    className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                    style={statusStyles(activeBatch?.status || "queued")}
                  >
                    {activeBatch?.status || "queued"}
                  </span>
                  <span style={{ color: THEME.secondary }}>{batchInfo}</span>
                  {activeBatch?.status === "queued" && (
                    <span style={{ color: THEME.secondary }}>
                      — waiting for processing
                    </span>
                  )}
                </div>
              )}
              {!batchInfo && (
                <div
                  className="mt-3 rounded-lg border px-3 py-2.5 text-xs leading-relaxed"
                  style={{
                    borderColor: THEME.border,
                    background: "#EFF6FF",
                    color: THEME.secondary,
                  }}
                >
                  Each link will be processed one by one automatically
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.form>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border shadow-sm overflow-hidden max-w-7xl mx-auto"
        style={{
          background: THEME.cardBg,
          borderColor: THEME.border,
        }}
      >
        <div
          className="px-5 sm:px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: THEME.border }}
        >
          <div className="flex items-center gap-3">
            <h2
              className="text-lg sm:text-xl font-semibold"
              style={{ color: THEME.text }}
            >
              Extraction Results
            </h2>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: "#DBEAFE", color: THEME.primary }}
            >
              {total} results
            </span>
          </div>
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={total === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition disabled:opacity-40"
            style={{ background: THEME.primary }}
            onMouseEnter={(e) => {
              if (total > 0) {
                e.currentTarget.style.background = THEME.primaryHover;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = THEME.primary;
            }}
          >
            <Download size={16} />
            Export (XLSX)
          </button>
        </div>

        {total === 0 ? (
          <div className="px-5 sm:px-6 py-16 text-center">
            <div
              className="text-base font-semibold"
              style={{ color: THEME.text }}
            >
              No results yet
            </div>
            <p
              className="text-sm mt-2"
              style={{ color: THEME.secondary }}
            >
              Results will appear when processing begins.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table
                className="w-full text-sm table-fixed"
                style={{ color: THEME.text }}
              >
                <colgroup>
                  <col style={{ width: "4%" }} />
                  <col style={{ width: "26%" }} />
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "17%" }} />
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "9%" }} />
                </colgroup>
                <thead style={{ background: THEME.headerBg }}>
                  <tr style={{ borderBottom: `1px solid ${THEME.border}` }}>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: THEME.secondary }}
                    >
                      #
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: THEME.secondary }}
                    >
                      User
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: THEME.secondary }}
                    >
                      Comment
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: THEME.secondary }}
                    >
                      Phone Number
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: THEME.secondary }}
                    >
                      Status
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: THEME.secondary }}
                    >
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row: MockExtractionResult, idx) => {
                    const rowNum = rangeStart + idx;
                    const st = mockStatusStyles(row.status);
                    return (
                      <tr
                        key={row.id}
                        style={{ borderBottom: `1px solid ${THEME.border}` }}
                        className="hover:bg-slate-50/80"
                      >
                        <td
                          className="px-3 py-3 align-middle text-xs tabular-nums"
                          style={{ color: THEME.secondary }}
                        >
                          {rowNum}
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={row.avatarUrl}
                              alt=""
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-full object-cover shrink-0 border"
                              style={{ borderColor: THEME.border }}
                              loading="lazy"
                            />
                            <div className="min-w-0 flex-1">
                              <div
                                className="font-medium truncate"
                                title={row.name}
                                style={{ color: THEME.text }}
                              >
                                {row.name}
                              </div>
                              <a
                                href={
                                  useMock ? "#" : row.profileUrl
                                }
                                onClick={
                                  useMock
                                    ? (e) => e.preventDefault()
                                    : undefined
                                }
                                target={useMock ? undefined : "_blank"}
                                rel={
                                  useMock ? undefined : "noopener noreferrer"
                                }
                                className="mt-0.5 flex items-center gap-1 text-xs truncate hover:underline"
                                style={{ color: THEME.secondary }}
                                title={row.profileUrl}
                              >
                                <span className="truncate">
                                  {row.profileUrlDisplay}
                                </span>
                                <ExternalLink
                                  size={12}
                                  className="shrink-0 opacity-70"
                                />
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle min-w-0">
                          <div
                            className="truncate"
                            style={{
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              color: THEME.text,
                            }}
                            title={row.comment}
                          >
                            {row.comment}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <WhatsAppIcon />
                            <span
                              className="tabular-nums"
                              style={{ color: THEME.text }}
                            >
                              {row.phone}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <span
                            className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize"
                            style={{
                              background: st.background,
                              color: st.color,
                            }}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td
                          className="px-3 py-3 align-middle text-xs whitespace-nowrap"
                          style={{ color: THEME.secondary }}
                        >
                          {row.updated}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className="px-5 sm:px-6 py-4 border-t flex flex-wrap items-center justify-between gap-3"
              style={{ borderColor: THEME.border }}
            >
              <div className="text-sm" style={{ color: THEME.secondary }}>
                Showing {rangeStart} to {rangeEnd} of {total} results
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-md border"
                  style={{
                    borderColor: THEME.border,
                    color: THEME.secondary,
                  }}
                >
                  {BATCH_RESULTS_PAGE_SIZE} / page
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border disabled:opacity-40"
                    style={{
                      borderColor: THEME.border,
                      color: THEME.text,
                      background: THEME.cardBg,
                    }}
                  >
                    Previous
                  </button>
                  {pageNumbers.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className="min-w-[32px] px-2 py-1.5 rounded-md text-xs font-medium border"
                      style={
                        n === page
                          ? {
                              borderColor: THEME.primary,
                              background: THEME.primary,
                              color: "#fff",
                            }
                          : {
                              borderColor: THEME.border,
                              background: THEME.cardBg,
                              color: THEME.text,
                            }
                      }
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-md text-xs font-medium border disabled:opacity-40"
                    style={{
                      borderColor: THEME.border,
                      color: THEME.text,
                      background: THEME.cardBg,
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default FacebookPostsBatchUI;
