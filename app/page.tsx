'use client';
import { useState } from 'react';

export default function Home() {
  const [form, setForm] = useState({
    lessonName: '',
    learningArea: '',
    teacherName: '',
    gradeSection: '',
    competency: '',
    sessions: '',
    classroomDetails: '',
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [showDonation, setShowDonation] = useState(false);
  const [copied, setCopied] = useState(false);

  const LOADING_MESSAGES = [
  '🤖 Groq AI is crafting your lesson plan...',
  '📝 Writing learning competencies and objectives...',
  '🎯 Designing session flow and activities...',
  '🏙️ Adding Davao City context to examples...',
  '📊 Building formative assessments...',
  '🌱 Almost done — finalizing your DOCX...',
  ];
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);

  const handleGenerate = async () => {
    setLoading(true);
    setStatus('generating');
    let msgIdx = 0;
    const msgTimer = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[msgIdx]);
    }, 7000);
    // Add in the finally block or after setLoading(false):
    clearInterval(msgTimer);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.content) throw new Error('No content returned');
      const { buildDocx } = await import('../lib/buildDocx');
      await buildDocx(data.content, form.teacherName, form.lessonName, form.learningArea, form.gradeSection, form.sessions);
      setStatus('success');
    } catch (e) {
      setStatus('error:' + (e as Error).message);
    }
    setLoading(false);
  };

  const copyGcash = () => {
    navigator.clipboard.writeText('09333496704');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allFilled = form.lessonName && form.competency && form.teacherName && form.learningArea;

  const fields = [
    { key: 'lessonName', label: 'Name of Lesson', placeholder: 'e.g. Law of Sines — Oblique Triangles', icon: '📖', area: false },
    { key: 'learningArea', label: 'Learning Area', placeholder: 'e.g. Mathematics 10', icon: '🎓', area: false },
    { key: 'teacherName', label: 'Teacher\'s Name', placeholder: 'Your full name', icon: '👩‍🏫', area: false },
    { key: 'gradeSection', label: 'Grade Level & Section', placeholder: 'e.g. Grade 10 — Rizal', icon: '🏫', area: false },
    { key: 'competency', label: 'Learning Competency (MELC)', placeholder: 'Paste the full MELC text and code here...', icon: '🎯', area: true },
    { key: 'sessions', label: 'No. of Sessions & Duration', placeholder: 'e.g. 3 sessions: 1hr 40min, 1hr 40min, 40min', icon: '⏱️', area: false },
    { key: 'classroomDetails', label: 'Classroom Details', placeholder: 'e.g. 50 students, no projector/TV, blackboard, cartolina available, Davao City context...', icon: '🏡', area: true },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: #fdf6f0;
          min-height: 100vh;
        }

        .page {
          min-height: 100vh;
          background: linear-gradient(135deg, #fdf6f0 0%, #fce9f1 40%, #ede4f7 100%);
          position: relative;
          overflow-x: hidden;
        }

        /* Decorative blobs */
        .blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.25;
          pointer-events: none;
          z-index: 0;
        }
        .blob-1 { width: 500px; height: 500px; background: #f9a8d4; top: -100px; right: -100px; }
        .blob-2 { width: 400px; height: 400px; background: #c4b5fd; bottom: 100px; left: -80px; }
        .blob-3 { width: 300px; height: 300px; background: #fbcfe8; top: 40%; left: 50%; }

        .container {
          position: relative;
          z-index: 1;
          max-width: 780px;
          margin: 0 auto;
          padding: 0 20px 60px;
        }

        /* ── HEADER ── */
        .header {
          text-align: center;
          padding: 52px 20px 36px;
        }

        .header-badge {
          display: inline-block;
          background: linear-gradient(135deg, #f472b6, #a78bfa);
          color: white;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 5px 16px;
          border-radius: 20px;
          margin-bottom: 18px;
        }

        .header h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(28px, 5vw, 42px);
          font-weight: 700;
          line-height: 1.15;
          color: #1e1240;
          margin-bottom: 10px;
        }

        .header h1 span {
          background: linear-gradient(135deg, #ec4899, #8b5cf6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .header-sub {
          font-size: 15px;
          color: #6b6080;
          font-weight: 400;
          line-height: 1.6;
          max-width: 520px;
          margin: 0 auto 20px;
        }

        .header-meta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .creator-tag {
          font-size: 13px;
          color: #8b7fa8;
          font-weight: 500;
        }

        .creator-tag strong {
          color: #6d28d9;
          font-weight: 600;
        }

        .donate-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: linear-gradient(135deg, #f472b6, #ec4899);
          color: white;
          border: none;
          border-radius: 20px;
          padding: 7px 16px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(244,114,182,0.4);
          transition: all 0.2s;
        }

        .donate-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(244,114,182,0.5);
        }

        /* ── CARD ── */
        .card {
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.9);
          border-radius: 24px;
          padding: 36px 40px;
          box-shadow: 0 8px 40px rgba(139,92,246,0.08), 0 2px 8px rgba(0,0,0,0.04);
        }

        .card-title {
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          color: #1e1240;
          margin-bottom: 28px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .card-title::after {
          content: '';
          flex: 1;
          height: 1px;
          background: linear-gradient(to right, #e9d5ff, transparent);
        }

        /* ── FIELDS ── */
        .fields-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .field-full { grid-column: 1 / -1; }

        .field-group { display: flex; flex-direction: column; gap: 7px; }

        .field-label {
          font-size: 12.5px;
          font-weight: 600;
          color: #5b4f7a;
          letter-spacing: 0.3px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .field-label .icon { font-size: 14px; }

        .field-input, .field-textarea {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid #e5d5f5;
          border-radius: 12px;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          color: #1e1240;
          background: rgba(255,255,255,0.8);
          transition: all 0.2s;
          outline: none;
        }

        .field-input::placeholder, .field-textarea::placeholder { color: #b8a9cc; }

        .field-input:focus, .field-textarea:focus {
          border-color: #a78bfa;
          background: white;
          box-shadow: 0 0 0 3px rgba(167,139,250,0.15);
        }

        .field-textarea { resize: vertical; min-height: 88px; line-height: 1.55; }

        /* ── GENERATE BUTTON ── */
        .gen-wrap { margin-top: 28px; }

        .gen-btn {
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 16px;
          font-family: 'DM Sans', sans-serif;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s;
          position: relative;
          overflow: hidden;
        }

        .gen-btn.ready {
          background: linear-gradient(135deg, #7c3aed, #ec4899);
          color: white;
          box-shadow: 0 8px 24px rgba(124,58,237,0.35);
        }

        .gen-btn.ready:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(124,58,237,0.45);
        }

        .gen-btn.ready:active { transform: translateY(0); }

        .gen-btn.loading {
          background: linear-gradient(135deg, #a78bfa, #f9a8d4);
          color: white;
          cursor: not-allowed;
        }

        .gen-btn.disabled {
          background: #e5d5f5;
          color: #b8a9cc;
          cursor: not-allowed;
        }

        /* Loading dots animation */
        .dots span {
          display: inline-block;
          animation: bounce 1.2s infinite;
          font-size: 20px;
        }
        .dots span:nth-child(2) { animation-delay: 0.2s; }
        .dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }

        /* ── STATUS ── */
        .status-box {
          margin-top: 16px;
          padding: 14px 18px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 10px;
          animation: fadeIn 0.3s ease;
        }

        .status-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
        .status-error { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }
        .status-loading { background: #faf5ff; color: #6d28d9; border: 1px solid #e9d5ff; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

        /* Shimmer effect on loading button */
        .gen-btn.loading::after {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer { to { left: 100%; } }

        /* ── DONATION MODAL ── */
        .modal-overlay {
          position: fixed; inset: 0;
          background: rgba(30,18,64,0.5);
          backdrop-filter: blur(4px);
          z-index: 100;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }

        .modal {
          background: white;
          border-radius: 24px;
          padding: 36px;
          max-width: 400px;
          width: 100%;
          box-shadow: 0 24px 60px rgba(124,58,237,0.2);
          position: relative;
          text-align: center;
        }

        .modal-close {
          position: absolute; top: 16px; right: 16px;
          background: #f3e8ff; border: none; border-radius: 50%;
          width: 32px; height: 32px; cursor: pointer;
          font-size: 16px; color: #7c3aed;
          display: flex; align-items: center; justify-content: center;
        }

        .modal-heart { font-size: 48px; margin-bottom: 12px; }

        .modal h2 {
          font-family: 'Playfair Display', serif;
          font-size: 22px; color: #1e1240;
          margin-bottom: 8px;
        }

        .modal p { font-size: 14px; color: #6b6080; line-height: 1.6; margin-bottom: 20px; }

        .gcash-box {
          background: linear-gradient(135deg, #00c0ef, #0078d4);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 16px;
          color: white;
        }

        .gcash-label { font-size: 12px; font-weight: 600; letter-spacing: 1px; opacity: 0.8; margin-bottom: 6px; }
        .gcash-number { font-size: 28px; font-weight: 700; letter-spacing: 2px; margin-bottom: 4px; }
        .gcash-name { font-size: 13px; opacity: 0.85; }

        .copy-btn {
          width: 100%;
          padding: 13px;
          background: linear-gradient(135deg, #7c3aed, #ec4899);
          color: white; border: none; border-radius: 12px;
          font-family: 'DM Sans', sans-serif;
          font-size: 15px; font-weight: 600; cursor: pointer;
          transition: all 0.2s;
        }

        .copy-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(124,58,237,0.35); }

        .modal-note { font-size: 12px; color: #b8a9cc; margin-top: 12px; }

        /* ── FOOTER ── */
        .footer {
          text-align: center;
          margin-top: 36px;
          font-size: 12px;
          color: #b8a9cc;
          line-height: 1.8;
        }

        .footer strong { color: #8b7fa8; }

        /* ── DIVIDER ── */
        .divider {
          height: 1px;
          background: linear-gradient(to right, transparent, #e9d5ff, transparent);
          margin: 28px 0;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 600px) {
          .card { padding: 24px 20px; }
          .fields-grid { grid-template-columns: 1fr; }
          .field-full { grid-column: 1; }
          .header { padding: 36px 16px 24px; }
        }
      `}</style>

      <div className="page">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />

        <div className="container">

          {/* ── HEADER ── */}
          <header className="header">
            <div className="header-badge">✦ DepEd ILAW Framework ✦</div>
            <h1>ILAW Lesson Plan<br /><span>AI Generator</span></h1>
            <p className="header-sub">
              Generate detailed, contextualized, and classroom-ready ILAW-format lesson plans in seconds — tailored for Davao City teachers.
            </p>
            <div className="header-meta">
              <span className="creator-tag">Crafted by <strong>Hazsher Briz Munjilul</strong></span>
              <span className="creator-tag" style={{ color: '#c4b5fd' }}>•</span>
              <span className="creator-tag">Powered by Groq AI</span>
              <button className="donate-btn" onClick={() => setShowDonation(true)}>
                💝 Support this tool
              </button>
            </div>
          </header>

          {/* ── MAIN CARD ── */}
          <div className="card">
            <div className="card-title">
              ✏️ Lesson Details
            </div>

            <div className="fields-grid">
              {fields.map(f => (
                <div key={f.key} className={`field-group${f.area || f.key === 'competency' || f.key === 'classroomDetails' ? ' field-full' : ''}`}>
                  <label className="field-label">
                    <span className="icon">{f.icon}</span>
                    {f.label}
                  </label>
                  {f.area ? (
                    <textarea
                      className="field-textarea"
                      placeholder={f.placeholder}
                      value={(form as any)[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      rows={f.key === 'competency' ? 3 : 4}
                    />
                  ) : (
                    <input
                      type="text"
                      className="field-input"
                      placeholder={f.placeholder}
                      value={(form as any)[f.key]}
                      onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="divider" />

            <div className="gen-wrap">
              <button
                className={`gen-btn ${loading ? 'loading' : allFilled ? 'ready' : 'disabled'}`}
                onClick={handleGenerate}
                disabled={loading || !allFilled}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <span className="dots">
                      <span>•</span><span>•</span><span>•</span>
                    </span>
                    Writing your lesson plan...
                  </span>
                ) : (
                  '✨ Generate ILAW Lesson Plan'
                )}
              </button>

              {status === 'generating' && (
                <div className="status-box status-loading">
                  🤖 {loadingMessage}
                </div>
              )}
              {status === 'success' && (
                <div className="status-box status-success">
                  ✅ Your ILAW lesson plan has been generated and is downloading now!
                </div>
              )}
              {status.startsWith('error') && (
                <div className="status-box status-error">
                  ❌ {status.replace('error:', '') || 'Something went wrong. Please try again.'}
                </div>
              )}
            </div>
          </div>

          {/* ── FOOTER ── */}
          <footer className="footer">
            <p>Made with 💜 for DepEd teachers in <strong>Davao City</strong></p>
            <p style={{ marginTop: 4 }}>
              ILAW Framework · SY 2026–2027 · Created by <strong>Hazsher Briz Munjilul</strong>
            </p>
          </footer>

        </div>
      </div>

      {/* ── DONATION MODAL ── */}
      {showDonation && (
        <div className="modal-overlay" onClick={() => setShowDonation(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowDonation(false)}>✕</button>
            <div className="modal-heart">💝</div>
            <h2>Support This Tool</h2>
            <p>
              This app is free for all DepEd teachers. If it has saved you time and made your lesson planning easier, consider sending a small token of appreciation!
            </p>
            <div className="gcash-box">
              <div className="gcash-label">GCASH NUMBER</div>
              <div className="gcash-number">0933 349 6704</div>
              <div className="gcash-name">Hazsher Briz Munjilul</div>
            </div>
            <button className="copy-btn" onClick={copyGcash}>
              {copied ? '✅ Number Copied!' : '📋 Copy GCash Number'}
            </button>
            <p className="modal-note">
              Every contribution, no matter how small, helps keep this tool free and running. Salamat! 🙏
            </p>
          </div>
        </div>
      )}
    </>
  );
}