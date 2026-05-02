import { useEffect, useRef, useState } from "react";
import { askQuestion, deleteDocument, fetchDocuments, uploadPdf } from "./api";

function IconPlus() {
  return (
    <svg className="cg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg className="cg-icon cg-icon--send" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M12 18V7M12 7l4.5 4.5M12 7L7.5 11.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg className="cg-icon cg-icon--sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" strokeLinejoin="round" />
      <path d="M14 2v6h6" strokeLinejoin="round" />
    </svg>
  );
}

function IconPanel() {
  return (
    <svg className="cg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="14" y="4" width="7" height="10" rx="1.5" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg className="cg-icon cg-icon--xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2m-9 4v10h10V10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 14v-4M14 14v-4" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 769px)").matches : true
  );
  const fileRef = useRef(null);
  const streamRef = useRef(null);
  const msgIdRef = useRef(0);
  function nextId() {
    msgIdRef.current += 1;
    return msgIdRef.current;
  }

  async function loadDocuments() {
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch {
      setDocuments([]);
    }
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 769px)");
    const onChange = () => {
      if (mq.matches) setSidebarOpen(true);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }
    setError("");
    setUploading(true);
    try {
      await uploadPdf(file);
      await loadDocuments();
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "system",
          content: `Indexed “${file.name}”. You can ask questions about it below.`,
        },
      ]);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    if (documents.length === 0) {
      setError("Upload a PDF first using the + button.");
      return;
    }
    setError("");
    setInput("");
    const userMsg = { id: nextId(), role: "user", content: q };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await askQuestion(q);
      const ctx = Array.isArray(res.context_used) ? res.context_used : [];
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: res.answer || "",
          contextUsed: ctx,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: `Something went wrong: ${err.message || "Request failed"}`,
          contextUsed: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function insertPrompt(text) {
    setInput(text);
  }

  async function handleDeleteDocument(doc) {
    if (
      !window.confirm(
        `Remove “${doc.filename}” from the index?\n\nIt will be hidden from answers but kept in the database (soft delete).`
      )
    ) {
      return;
    }
    setError("");
    setDeletingId(doc.id);
    try {
      await deleteDocument(doc.id);
      await loadDocuments();
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "system",
          content: `Removed “${doc.filename}” from your active documents.`,
        },
      ]);
    } catch (err) {
      setError(err.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  const emptyChat = messages.length === 0 && !loading;

  return (
    <div className="chat-app">
      <div className={`sidebar-backdrop ${sidebarOpen ? "sidebar-backdrop--show" : ""}`} onClick={() => setSidebarOpen(false)} aria-hidden />

      <aside className={`sidebar ${sidebarOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar-header">
          <span className="sidebar-title">Indexed documents</span>
          <button type="button" className="icon-btn" title="Close panel" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            ×
          </button>
        </div>
        <div className="sidebar-scroll">
          {documents.length === 0 ? (
            <p className="sidebar-empty">No PDFs yet. Use + in the message bar to upload.</p>
          ) : (
            <ul className="doc-list">
              {documents.map((doc) => (
                <li key={doc.id} className="doc-item">
                  <span className="doc-item-icon">
                    <IconFile />
                  </span>
                  <span className="doc-item-name">{doc.filename}</span>
                  <button
                    type="button"
                    className="doc-item-delete"
                    title="Remove from index"
                    aria-label={`Remove ${doc.filename}`}
                    disabled={deletingId === doc.id || uploading || loading}
                    onClick={() => handleDeleteDocument(doc)}
                  >
                    {deletingId === doc.id ? <span className="doc-item-spinner" aria-hidden /> : <IconTrash />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="sidebar-footer">
          <div className="sidebar-brand">
            <span className="sidebar-avatar">DQ</span>
            <span className="sidebar-brand-text">DocQuery Lite</span>
          </div>
        </div>
      </aside>

      <div className="chat-main">
        <header className="chat-topbar">
          <button
            type="button"
            className="icon-btn icon-btn--ghost"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open indexed documents"
            title="Indexed documents"
          >
            <IconPanel />
          </button>
          <div className="topbar-brand">
            <span className="topbar-logo">DocQuery</span>
            <span className="topbar-badge">RAG</span>
          </div>
          <div className="topbar-spacer" />
        </header>

        <div className="chat-stream" ref={streamRef}>
          {emptyChat ? (
            <div className="chat-empty">
              <h1 className="chat-greeting">What&apos;s on your mind today?</h1>
              <p className="chat-sub">Upload a PDF with +, then ask anything about your documents.</p>
            </div>
          ) : (
            <div className="messages">
              {messages.map((m) => (
                <div key={m.id} className={`msg msg--${m.role}`}>
                  {m.role === "system" ? (
                    <div className="msg-system">{m.content}</div>
                  ) : (
                    <>
                      <div className="msg-bubble">
                        <p className="msg-text">{m.content}</p>
                      </div>
                      {m.role === "assistant" && m.contextUsed?.length > 0 ? (
                        <details className="msg-sources">
                          <summary>Sources used</summary>
                          <ul>
                            {m.contextUsed.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </>
                  )}
                </div>
              ))}
              {loading ? (
                <div className="msg msg--assistant">
                  <div className="msg-bubble msg-bubble--typing">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="chat-bottom">
          {error ? (
            <div className="inline-error" role="alert">
              {error}
            </div>
          ) : null}
          <form className="composer" onSubmit={handleSubmit}>
            <div className="composer-pill">
              <button
                type="button"
                className="composer-plus"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || loading}
                title="Upload PDF"
                aria-label="Upload PDF"
              >
                {uploading ? <span className="composer-spinner" /> : <IconPlus />}
              </button>
              <input ref={fileRef} type="file" accept="application/pdf" className="visually-hidden" onChange={handleFileChange} />
              <input
                className="composer-input"
                placeholder="Ask anything"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoComplete="off"
                disabled={loading}
              />
              <button type="submit" className="composer-send" disabled={loading || !input.trim() || documents.length === 0} title="Send" aria-label="Send">
                <IconSend />
              </button>
            </div>
          </form>
          <div className="quick-prompts">
            <button type="button" className="chip" onClick={() => insertPrompt("Summarize the main points from my documents.")}>
              Summarize
            </button>
            <button type="button" className="chip" onClick={() => insertPrompt("What are the key facts I should remember?")}>
              Key facts
            </button>
            <button type="button" className="chip" onClick={() => fileRef.current?.click()}>
              Upload PDF
            </button>
          </div>
          <p className="chat-disclaimer">Answers use your indexed PDFs. Check important details in the original files.</p>
        </div>
      </div>
    </div>
  );
}
