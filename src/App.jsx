import { useEffect, useState } from "react";
import { askQuestion, fetchDocuments, uploadPdf } from "./api";

export default function App() {
  const [file, setFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [contextUsed, setContextUsed] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  async function onUpload(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      await uploadPdf(file);
      setFile(null);
      await loadDocuments();
      alert("PDF indexed successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onAsk(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setAnswer("");
    setContextUsed([]);
    try {
      const res = await askQuestion(question);
      setAnswer(res.answer);
      setContextUsed(Array.isArray(res.context_used) ? res.context_used : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      <main className="page">
        <header className="hero card">
          <p className="badge">RAG Document Assistant</p>
          <h1>DocQuery Lite</h1>
          <p className="sub">Upload PDF documents and ask smart questions with clean, instant answers.</p>
        </header>

        <div className="grid">
          <section className="card">
            <h2>Upload PDF</h2>
            <p className="muted">Choose a PDF file to extract text and build searchable chunks.</p>
            <form className="form-row" onSubmit={onUpload}>
              <label className="file-input">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <button className="primary-btn" disabled={loading || !file} type="submit">
                {loading ? "Processing..." : "Upload & Index"}
              </button>
            </form>
          </section>

          <section className="card">
            <h2>Ask Question</h2>
            <p className="muted">Query your uploaded documents in natural language.</p>
            <form className="form-row" onSubmit={onAsk}>
              <input
                className="text-input"
                type="text"
                placeholder="Ask from uploaded PDFs..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
              <button className="primary-btn" disabled={loading || !question.trim()} type="submit">
                {loading ? "Thinking..." : "Ask"}
              </button>
            </form>
            {answer && (
              <div className="answer">
                <strong>Answer</strong>
                <p>{answer}</p>
              </div>
            )}
            {contextUsed.length > 0 && (
              <div className="context-card">
                <strong>Matched Context</strong>
                <ul>
                  {contextUsed.map((ctx, idx) => (
                    <li key={idx}>{ctx}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <section className="card">
          <div className="doc-head">
            <h2>Indexed Documents</h2>
            <span className="doc-count">{documents.length}</span>
          </div>
          {documents.length === 0 ? (
            <p className="empty">No documents indexed yet.</p>
          ) : (
            <ul className="doc-list">
              {documents.map((doc) => (
                <li key={doc.id}>{doc.filename}</li>
              ))}
            </ul>
          )}
        </section>

        {error && <p className="error">{error}</p>}
      </main>
    </div>
  );
}
