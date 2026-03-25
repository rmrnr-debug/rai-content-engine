"use client";

import { useState } from "react";

const TOPICS_SUGGEST = [
  "pulau ramai vs sepi",
  "kenapa pilih pulau kecil",
  "pagi hari di pantai",
  "aktivitas seru di laut",
  "penginapan kayu tepi pantai",
  "kabur dari jakarta",
  "aqua warrior challenge",
  "sunset di pulau payung",
];

function parseScript(text) {
  const sections = [
    { key: "hook", label: "HOOK", icon: "⚡" },
    { key: "visual", label: "VISUAL", icon: "🎬" },
    { key: "voiceover", label: "VOICEOVER", icon: "🎙️" },
    { key: "cta", label: "CTA", icon: "👆" },
    { key: "caption", label: "CAPTION IG", icon: "✍️" },
    { key: "hashtag", label: "HASHTAG", icon: "#" },
  ];

  const result = {};
  const lines = text.split("\n");

  sections.forEach(({ key, label }) => {
    const startIdx = lines.findIndex((l) =>
      l.trim().toUpperCase().startsWith(label)
    );
    if (startIdx === -1) return;

    const nextLabels = sections
      .filter((s) => s.key !== key)
      .map((s) => s.label);

    let endIdx = lines.length;
    for (let i = startIdx + 1; i < lines.length; i++) {
      if (nextLabels.some((nl) => lines[i].trim().toUpperCase().startsWith(nl))) {
        endIdx = i;
        break;
      }
    }

    const content = lines
      .slice(startIdx + 1, endIdx)
      .join("\n")
      .trim();

    result[key] = content;
  });

  return Object.keys(result).length > 0 ? result : null;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} style={styles.copyBtn}>
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

function ScriptCard({ icon, label, content }) {
  return (
    <div style={styles.scriptCard}>
      <div style={styles.scriptCardHeader}>
        <span style={styles.scriptIcon}>{icon}</span>
        <span style={styles.scriptLabel}>{label}</span>
        <CopyButton text={content} />
      </div>
      <p style={styles.scriptContent}>{content}</p>
    </div>
  );
}

export default function ContentMachine() {
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState("business");
  const [engine, setEngine] = useState("claude");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [rawResult, setRawResult] = useState("");
  const [error, setError] = useState("");
  const [meta, setMeta] = useState(null);

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setRawResult("");

    try {
      const res = await fetch("/api/content-machine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, mode, engine }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Terjadi kesalahan");
        return;
      }

      setMeta(data.meta);
      setRawResult(data.result);
      const parsed = parseScript(data.result);
      setResult(parsed);
    } catch (e) {
      setError("Gagal konek ke server. Cek koneksi kamu.");
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    { key: "hook", label: "HOOK", icon: "⚡" },
    { key: "visual", label: "VISUAL", icon: "🎬" },
    { key: "voiceover", label: "VOICEOVER", icon: "🎙️" },
    { key: "cta", label: "CTA", icon: "👆" },
    { key: "caption", label: "CAPTION IG", icon: "✍️" },
    { key: "hashtag", label: "HASHTAG", icon: "#" },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoRow}>
            <span style={styles.logo}>enjoypayung</span>
            <span style={styles.logoDot}>•</span>
            <span style={styles.logoSub}>content machine</span>
          </div>
          <p style={styles.headerDesc}>
            generate script TikTok & Reels otomatis
          </p>
        </div>

        {/* Form */}
        <div style={styles.form}>

          {/* Topic Input */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>topik konten</label>
            <input
              style={styles.input}
              type="text"
              placeholder="contoh: pagi hari di pantai..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && generate()}
            />
          </div>

          {/* Topic Suggestions */}
          <div style={styles.suggestions}>
            {TOPICS_SUGGEST.map((t) => (
              <button
                key={t}
                style={{
                  ...styles.pill,
                  ...(topic === t ? styles.pillActive : {}),
                }}
                onClick={() => setTopic(t)}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Mode + Engine */}
          <div style={styles.toggleRow}>
            <div style={styles.toggleGroup}>
              <span style={styles.toggleLabel}>mode</span>
              <div style={styles.toggleButtons}>
                {["business", "personal"].map((m) => (
                  <button
                    key={m}
                    style={{
                      ...styles.toggleBtn,
                      ...(mode === m ? styles.toggleBtnActive : {}),
                    }}
                    onClick={() => setMode(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.toggleGroup}>
              <span style={styles.toggleLabel}>engine</span>
              <div style={styles.toggleButtons}>
                {["claude", "openai"].map((e) => (
                  <button
                    key={e}
                    style={{
                      ...styles.toggleBtn,
                      ...(engine === e ? styles.toggleBtnActiveEngine : {}),
                    }}
                    onClick={() => setEngine(e)}
                  >
                    {e === "claude" ? "claude" : "gpt-4o"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button
            style={{
              ...styles.generateBtn,
              ...(loading ? styles.generateBtnLoading : {}),
            }}
            onClick={generate}
            disabled={loading || !topic.trim()}
          >
            {loading ? (
              <span style={styles.loadingText}>
                <span style={styles.spinner}>◌</span>
                generating dengan {engine}...
              </span>
            ) : (
              `generate script ↗`
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Result */}
        {(result || rawResult) && (
          <div style={styles.resultSection}>
            {/* Meta info */}
            {meta && (
              <div style={styles.metaRow}>
                <span style={styles.metaBadge}>{meta.engine}</span>
                <span style={styles.metaBadge}>{meta.mode}</span>
                <span style={styles.metaTopic}>"{meta.topic}"</span>
                <CopyButton text={rawResult} />
              </div>
            )}

            {/* Parsed sections */}
            {result ? (
              <div style={styles.scriptGrid}>
                {sections.map(({ key, label, icon }) =>
                  result[key] ? (
                    <ScriptCard
                      key={key}
                      icon={icon}
                      label={label}
                      content={result[key]}
                    />
                  ) : null
                )}
              </div>
            ) : (
              // Fallback: raw output
              <div style={styles.rawBox}>
                <pre style={styles.rawText}>{rawResult}</pre>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#FAFAF7",
    fontFamily: "'DM Sans', 'Instrument Sans', sans-serif",
    padding: "0 0 4rem",
  },
  container: {
    maxWidth: "720px",
    margin: "0 auto",
    padding: "0 1.25rem",
  },
  header: {
    padding: "3rem 0 2rem",
    borderBottom: "1px solid #E8E6DF",
    marginBottom: "2rem",
  },
  logoRow: {
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
    marginBottom: "6px",
  },
  logo: {
    fontSize: "22px",
    fontWeight: "600",
    color: "#1A1A18",
    letterSpacing: "-0.5px",
  },
  logoDot: {
    color: "#1D9E75",
    fontSize: "20px",
  },
  logoSub: {
    fontSize: "14px",
    color: "#888780",
    fontWeight: "400",
  },
  headerDesc: {
    fontSize: "14px",
    color: "#888780",
    margin: "0",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    marginBottom: "2rem",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "500",
    color: "#888780",
    textTransform: "lowercase",
    letterSpacing: "0.03em",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    fontSize: "15px",
    border: "1px solid #E0DDD5",
    borderRadius: "10px",
    backgroundColor: "#FFFFFF",
    color: "#1A1A18",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  suggestions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  pill: {
    padding: "5px 12px",
    fontSize: "12px",
    border: "1px solid #E0DDD5",
    borderRadius: "20px",
    backgroundColor: "transparent",
    color: "#5F5E5A",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  pillActive: {
    backgroundColor: "#1A1A18",
    color: "#FFFFFF",
    borderColor: "#1A1A18",
  },
  toggleRow: {
    display: "flex",
    gap: "1.5rem",
    flexWrap: "wrap",
  },
  toggleGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  toggleLabel: {
    fontSize: "12px",
    fontWeight: "500",
    color: "#888780",
    textTransform: "lowercase",
  },
  toggleButtons: {
    display: "flex",
    gap: "4px",
  },
  toggleBtn: {
    padding: "6px 14px",
    fontSize: "13px",
    border: "1px solid #E0DDD5",
    borderRadius: "8px",
    backgroundColor: "transparent",
    color: "#888780",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  toggleBtnActive: {
    backgroundColor: "#1A1A18",
    color: "#FFFFFF",
    borderColor: "#1A1A18",
  },
  toggleBtnActiveEngine: {
    backgroundColor: "#1D9E75",
    color: "#FFFFFF",
    borderColor: "#1D9E75",
  },
  generateBtn: {
    width: "100%",
    padding: "14px",
    fontSize: "15px",
    fontWeight: "500",
    backgroundColor: "#1A1A18",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "-0.2px",
  },
  generateBtnLoading: {
    backgroundColor: "#444441",
    cursor: "not-allowed",
  },
  loadingText: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  spinner: {
    display: "inline-block",
    animation: "spin 1s linear infinite",
  },
  errorBox: {
    padding: "12px 16px",
    backgroundColor: "#FCEBEB",
    border: "1px solid #F09595",
    borderRadius: "10px",
    fontSize: "13px",
    color: "#A32D2D",
    marginBottom: "1.5rem",
  },
  resultSection: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    paddingBottom: "1rem",
    borderBottom: "1px solid #E8E6DF",
  },
  metaBadge: {
    padding: "3px 10px",
    fontSize: "11px",
    backgroundColor: "#E1F5EE",
    color: "#0F6E56",
    borderRadius: "20px",
    fontWeight: "500",
  },
  metaTopic: {
    fontSize: "13px",
    color: "#888780",
    flex: 1,
  },
  scriptGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  scriptCard: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #E8E6DF",
    borderRadius: "12px",
    padding: "1rem 1.25rem",
  },
  scriptCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px",
  },
  scriptIcon: {
    fontSize: "14px",
  },
  scriptLabel: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#888780",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    flex: 1,
  },
  scriptContent: {
    fontSize: "14px",
    color: "#1A1A18",
    lineHeight: "1.75",
    margin: "0",
    whiteSpace: "pre-wrap",
  },
  copyBtn: {
    padding: "3px 10px",
    fontSize: "11px",
    border: "1px solid #E0DDD5",
    borderRadius: "6px",
    backgroundColor: "transparent",
    color: "#888780",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  rawBox: {
    backgroundColor: "#FFFFFF",
    border: "1px solid #E8E6DF",
    borderRadius: "12px",
    padding: "1.25rem",
  },
  rawText: {
    fontSize: "13px",
    color: "#1A1A18",
    lineHeight: "1.8",
    margin: "0",
    whiteSpace: "pre-wrap",
    fontFamily: "inherit",
  },
};