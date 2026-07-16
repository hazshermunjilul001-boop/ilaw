'use client';
import { useState, useEffect } from 'react';

export default function Home() {
  const [form, setForm] = useState({
    lessonName: '',
    learningArea: '',
    teacherName: '',
    gradeSection: '',
    competency: '',
    sessions: '',
    classroomDetails: '',
    schoolCity: '',
  });

  // ── BYOK: Gemini first, then Groq, then OpenRouter ──────────────────
  const [geminiKey, setGeminiKey] = useState('');
  const [apiKey, setApiKey] = useState('');       // Groq primary
  const [apiKey2, setApiKey2] = useState('');     // Groq secondary
  const [openrouterKey, setOpenrouterKey] = useState('');

  useEffect(() => {
    const savedGemini = localStorage.getItem('ilaw_gemini_api_key');
    if (savedGemini) setGeminiKey(savedGemini);

    const savedKey = localStorage.getItem('ilaw_groq_api_key');
    if (savedKey) setApiKey(savedKey);

    const savedKey2 = localStorage.getItem('ilaw_groq_api_key_2');
    if (savedKey2) setApiKey2(savedKey2);

    const savedOpenrouter = localStorage.getItem('ilaw_openrouter_api_key');
    if (savedOpenrouter) setOpenrouterKey(savedOpenrouter);
  }, []);

  const handleGeminiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setGeminiKey(val);
    localStorage.setItem('ilaw_gemini_api_key', val);
  };

  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey(val);
    localStorage.setItem('ilaw_groq_api_key', val);
  };

  const handleKey2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiKey2(val);
    localStorage.setItem('ilaw_groq_api_key_2', val);
  };

  const handleOpenrouterKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setOpenrouterKey(val);
    localStorage.setItem('ilaw_openrouter_api_key', val);
  };

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [showDonation, setShowDonation] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [showSupportPopup, setShowSupportPopup] = useState(false);
  const [pptLoading, setPptLoading] = useState(false);
  const [pptError, setPptError] = useState<string | null>(null);

  const LOADING_MESSAGES = [
    '🤖 AI is crafting your ILAW lesson plan...',
    '📝 Writing learning competencies and objectives...',
    '🎯 Designing session flow using Learning Design Principles...',
    '🏙️ Contextualizing examples for your city...',
    '📊 Building formative assessments...',
    '🌱 Almost done — finalizing your DOCX...',
  ];
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);

  // ── UPDATED handleGenerate to send BOTH API Keys ─────────────────────
  const handleGenerate = async () => {
    setLoading(true);
    setStatus('generating');
    let msgIdx = 0;
    const msgTimer = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[msgIdx]);
    }, 7000);

    try {
      // Prepare payload including BOTH API Keys
      const payload = { ...form, geminiKey, apiKey, apiKey2, openrouterKey };

      // ── 3 staggered API calls ──
      // Spaced out (not fired all at once) so a single click doesn't spend
      // 3 of a free-tier Gemini key's ~10-15 requests-per-minute budget in
      // the same instant, leaving no headroom for retries.
      const STAGGER_MS = 1200;
      const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
      const post = (url: string) =>
        fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

      setLoadingMessage('🤖 Writing references, objectives, and learner context...');
      const resA = post('/api/generate/header');
      await delay(STAGGER_MS);
      const resFlow = post('/api/generate/flow');
      await delay(STAGGER_MS);
      const resD = post('/api/generate/assessment');

      // Parse all three responses
      async function parseRes(resOrPromise: Response | Promise<Response>, label: string) {
        const res = await resOrPromise;
        const rawText = await res.text();
        let data: any = {};
        try { data = JSON.parse(rawText); } catch {
          if (!res.ok) throw new Error(`${label} server error (${res.status}). Please try again.`);
          throw new Error(`Unexpected response from ${label}. Please try again.`);
        }
        if (data.error) throw new Error(data.error);
        if (!data.content) throw new Error(`No content returned from ${label}. Please try again.`);
        return data.content as string;
      }

      const [partA, partBC, partD] = await Promise.all([
        parseRes(resA,    'A-HEADER'),
        parseRes(resFlow, 'B+C-FLOW'),
        parseRes(resD,    'D-ASSESSMENT'),
      ]);

      const combinedContent = [partA, partBC, partD].join('\n\n');
      setGeneratedContent(combinedContent);

      console.log('RAW CONTENT PREVIEW:', combinedContent.substring(0, 2000));

      setLoadingMessage('🌱 Almost done — finalizing your DOCX...');

      // Call the server-side download route
      const dlRes = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: combinedContent,
          teacherName: form.teacherName,
          lessonName: form.lessonName,
          learningArea: form.learningArea,
          gradeSection: form.gradeSection,
          sessions: form.sessions,
        }),
      });

      if (!dlRes.ok) {
        const errData = await dlRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate DOCX');
      }

      const blob = await dlRes.blob();
      const safeName = form.lessonName
        ? form.lessonName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').slice(0, 60)
        : 'ILAW_Lesson_Plan';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStatus('success');
    } catch (e) {
      setStatus('error:' + (e as Error).message);
    } finally {
      clearInterval(msgTimer);
      setLoading(false);
    }
  };

  const copyGcash = () => {
    navigator.clipboard.writeText('09333496704');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── VALIDATION: no API key is strictly required ─────────────────────
  // Gemini is now the primary provider (server-side fallback keys cover
  // teachers who haven't added their own). Groq is a thin last-resort
  // backup, so it should never block generation.
  const allFilled =
    form.lessonName &&
    form.learningArea &&
    form.teacherName &&
    form.gradeSection &&
    form.sessions &&
    form.competency &&
    form.schoolCity;

  // ── Field definitions ──
  const fields = [
    {
      key: 'lessonName',
      label: 'Lesson Title',
      placeholder: 'e.g. Law of Sines — Oblique Triangles',
      icon: '📖',
      area: false,
      required: true,
    },
    {
      key: 'learningArea',
      label: 'Learning Area/s',
      placeholder: 'e.g. Mathematics 10',
      icon: '🎓',
      area: false,
      required: true,
    },
    {
      key: 'teacherName',
      label: 'Name of Teacher/s',
      placeholder: 'Your full name',
      icon: '👩‍🏫',
      area: false,
      required: true,
    },
    {
      key: 'gradeSection',
      label: 'Grade Level and Section',
      placeholder: 'e.g. Grade 10 — Rizal',
      icon: '🏫',
      area: false,
      required: true,
    },
    {
      key: 'schoolCity',
      label: 'School City / Municipality',
      placeholder: 'e.g. Davao City, Cebu City, Manila...',
      icon: '📍',
      area: false,
      required: true,
    },
    {
      key: 'sessions',
      label: 'No. of Sessions & Duration',
      placeholder: 'e.g. 3 sessions: 1hr 40min, 1hr 40min, 40min',
      icon: '⏱️',
      area: false,
      required: true,
    },
    {
      key: 'competency',
      label: 'Learning Competency (MELC)',
      placeholder: 'Paste the full MELC text and code here...',
      icon: '🎯',
      area: true,
      required: true,
    },
    {
      key: 'classroomDetails',
      label: 'Classroom Details (optional)',
      placeholder: 'e.g. 50 students, no projector/TV, blackboard and cartolina available, learner context notes...',
      icon: '🏡',
      area: true,
      required: false,
    },
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

        /* ── DO 016 info strip ── */
        .do-strip {
          background: rgba(124,58,237,0.07);
          border: 1px solid rgba(167,139,250,0.3);
          border-radius: 14px;
          padding: 12px 20px;
          margin-bottom: 20px;
          font-size: 12.5px;
          color: #5b4f7a;
          line-height: 1.6;
          text-align: center;
        }
        .do-strip strong { color: #6d28d9; }

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

        /* Required marker */
        .req {
          color: #ec4899;
          font-size: 11px;
          margin-left: 2px;
        }

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

        /* Required field hint */
        .req-note {
          font-size: 11.5px;
          color: #b8a9cc;
          margin-top: 4px;
        }
        .req-note span { color: #ec4899; }
        .req-note a { color: #6d28d9; text-decoration: underline; }

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
        .status-error   { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }
        .status-loading { background: #faf5ff; color: #6d28d9; border: 1px solid #e9d5ff; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

        .gen-btn.loading::after {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: shimmer 1.5s infinite;
        }
        @keyframes shimmer { to { left: 100%; } }

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

        .gcash-label  { font-size: 12px; font-weight: 600; letter-spacing: 1px; opacity: 0.8; margin-bottom: 6px; }
        .gcash-number { font-size: 28px; font-weight: 700; letter-spacing: 2px; margin-bottom: 4px; }
        .gcash-name   { font-size: 13px; opacity: 0.85; }

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

        .footer {
          text-align: center;
          margin-top: 36px;
          font-size: 12px;
          color: #b8a9cc;
          line-height: 1.8;
        }

        .footer strong { color: #8b7fa8; }

        .divider {
          height: 1px;
          background: linear-gradient(to right, transparent, #e9d5ff, transparent);
          margin: 28px 0;
        }

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
            <div className="header-badge">✦ DepEd DO 016 s.2026 · ILAW Framework ✦</div>
            <h1>ILAW Lesson Plan<br /><span>Generator</span></h1>
            <p className="header-sub">
              Generate contextualized, classroom-ready ILAW-format lesson plans aligned with DepEd Order No. 016, s. 2026 — designed for Filipino teachers.
            </p>
            <div className="header-meta">
              <span className="creator-tag">Crafted by <strong>Hazsher Briz Munjilul</strong></span>
              <span className="creator-tag" style={{ color: '#c4b5fd' }}>•</span>
              <span className="creator-tag">Powered by Groq</span>

              {/* New Button - JHS Budget of Works */}
              <a
                href="https://drive.google.com/drive/folders/150nD7_y80SYCVNTKSbdlTZUcWOLKuO-m?usp=sharing"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #10b981, #34d399)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  padding: '7px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 18px rgba(16,185,129,0.5)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(16,185,129,0.4)';
                }}
              >
                📚 JHS Unpacked BOWs
              </a>

              <button className="donate-btn" onClick={() => setShowDonation(true)}>
                💝 Support this tool
              </button>
            </div>
          </header>

          {/* ── DO 016 INFO STRIP ── */}
          <div className="do-strip">
            📋 Aligned with <strong>DepEd Order No. 016, s. 2026</strong> — Guidelines on Lesson Planning and Learning Design.
            Generates lesson plans using the <strong>ILAW Framework</strong>: Intentions · Learning Experience · Assessing Learning · Ways Forward.
          </div>

          {/* ── MAIN CARD ── */}
          <div className="card">
            <div className="card-title">
              ✏️ Lesson Details
            </div>

            {/* ── API KEY INPUTS ── */}
            <label className="field-label" style={{ color: '#5b21b6' }}>
                <span className="icon">✨</span>
                Google Gemini API Key <span className="req">*</span> (recommended — try this first)
              </label>
              <input
                type="password"
                className="field-input"
                placeholder="Paste your Gemini API key (from aistudio.google.com)"
                value={geminiKey}
                onChange={handleGeminiKeyChange}
                style={{ background: '#fff', borderColor: '#c4b5fd' }}
              />
              <p className="req-note" style={{ marginTop: 6, marginBottom: 16, color: '#5b21b6' }}>
                Get a free key at{' '}
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#5b21b6', fontWeight: 600 }}>
                  aistudio.google.com/apikey
                </a>{' '}
                — use your existing Gmail account, no separate signup.
              </p>

              <label className="field-label" style={{ color: '#5b21b6' }}>
                <span className="icon">🔑</span>
                Primary Groq API Key <span className="req">*</span>
              </label>
              <input
                type="password"
                className="field-input"
                placeholder="gsk_..."
                value={apiKey}
                onChange={handleKeyChange}
                style={{ background: '#fff', borderColor: '#c4b5fd' }}
              />

              {/* ── SECONDARY GROQ API KEY ── */}
              <div style={{ marginTop: 12 }}>
                 <label className="field-label" style={{ color: '#6d28d9' }}>
                  <span className="icon">🔑</span>
                  Secondary Groq API Key (Optional)
                </label>
                <input
                  type="password"
                  className="field-input"
                  placeholder="gsk_... (Backup key for heavy usage)"
                  value={apiKey2}
                  onChange={handleKey2Change}
                  style={{ background: '#fff', borderColor: '#ddd6fe', fontSize: '13px' }}
                />
                <p className="req-note" style={{ marginTop: 6, color: '#6d28d9' }}>
                  Used if the primary key hits rate limits. Increases reliability.
                </p>
              </div>

              {/* ── ADDED INFO TEXT ── */}
              <p style={{ fontSize: 11.5, color: '#5b21b6', margin: '12px 0 0 0', lineHeight: 1.5, opacity: 0.85 }}>
                Required to generate. Get a free key at{' '}
                <a 
                  href="https://console.groq.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#4c1d95', textDecoration: 'underline', fontWeight: 600 }}
                >
                  console.groq.com
                </a>
                . Your key is saved securely in your browser and never shared.
              </p>
            </div>
            
              {/* ── OPENROUTER API KEY (Optional 3rd fallback) ── */}
              <div style={{ marginTop: 12 }}>
                 <label className="field-label" style={{ color: '#6d28d9' }}>
                  <span className="icon">🔑</span>
                  OpenRouter API Key (Optional 3rd fallback)
                </label>
                <input
                  type="password"
                  className="field-input"
                  placeholder="sk-or-... (Used only if Gemini and Groq both fail)"
                  value={openrouterKey}
                  onChange={handleOpenrouterKeyChange}
                  style={{ background: '#fff', borderColor: '#ddd6fe', fontSize: '13px' }}
                />
                <p className="req-note" style={{ marginTop: 6, color: '#6d28d9' }}>
                  Last-resort fallback. Get a free key at{' '}
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: '#6d28d9', fontWeight: 600 }}>
                    openrouter.ai/keys
                  </a>.
                </p>
              </div>

              {/* ── ADDED TIP BOX ── */}
              <div style={{
                 marginTop: 12,
                 padding: '10px 12px',
                 background: '#ffffff',
                 border: '1px dashed #c4b5fd',
                 borderRadius: 8,
                 fontSize: '11px',
                 color: '#4c1d95',
                 lineHeight: 1.5
              }}>
                 <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    💡 Recommended Setup
                 </div>
                 <div style={{ marginBottom: 4 }}>
                    <strong>Casual Use:</strong> Using 2 keys from 1 email is fine. It prevents the app from crashing if one key fails.
                 </div>
                 <div>
                    <strong>Heavy Use:</strong> Create a second Groq account (using a different email or +alias) and use that key as your Secondary API Key. This makes the app extremely powerful and efficient.
                 </div>
              </div>

            <p className="req-note" style={{ marginBottom: 18 }}>
              Fields marked <span>*</span> are required to generate your lesson plan.
            </p>

            <div className="fields-grid">
              {fields.map(f => (
                <div key={f.key} className={`field-group${f.area ? ' field-full' : ''}`}>
                  <label className="field-label">
                    <span className="icon">{f.icon}</span>
                    {f.label}
                    {f.required && <span className="req">*</span>}
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

              {!allFilled && !loading && (
                <>
                  <p className="req-note" style={{ marginTop: 10, textAlign: 'center' }}>
                    Please fill in all required fields <span>*</span> and add your <span>API Key</span> to enable generation.
                  </p>
                  <p className="req-note" style={{ marginTop: 10, textAlign: 'center' }}>
                    <strong>"If you get an error, wait 1 minute before trying again. The system needs to cool down."</strong>
                  </p>
                </>
              )}

              {/* Generate Slides button — appears after LP is generated */}
              {generatedContent && !loading && (
                <button
                  onClick={() => setShowSupportPopup(true)}
                  disabled={pptLoading}
                  style={{
                    marginTop: 14,
                    width: '100%',
                    padding: '14px 0',
                    borderRadius: 12,
                    border: 'none',
                    background: pptLoading
                      ? '#888'
                      : 'linear-gradient(135deg, #1B5E20 0%, #F9A825 100%)',
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: pptLoading ? 'not-allowed' : 'pointer',
                    letterSpacing: 0.5,
                  }}
                >
                  {pptLoading ? '⏳ Generating Slides...' : '📊 Generate PowerPoint Slides'}
                </button>
              )}

              {pptError && (
                <p style={{ color: '#c0392b', marginTop: 8, textAlign: 'center', fontSize: 13 }}>
                  ❌ {pptError}
                </p>
              )}

              {/* GCash Support Popup */}
              {showSupportPopup && (
                <div style={{
                  position: 'fixed', inset: 0, zIndex: 1000,
                  background: 'rgba(0,0,0,0.55)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{
                    background: '#fff', borderRadius: 18, padding: 32,
                    maxWidth: 420, width: '90%', textAlign: 'center',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
                  }}>
                    {/* Gold top accent */}
                    <div style={{ background: 'linear-gradient(135deg, #1B5E20, #F9A825)', height: 6, borderRadius: '12px 12px 0 0', margin: '-32px -32px 24px-32px' }} />

                    <div style={{ fontSize: 40, marginBottom: 8 }}>🙏</div>
                    <h2 style={{ color: '#1B5E20', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
                      This Tool is Free for All Teachers!
                    </h2>
                    <p style={{ color: '#444', fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
                      If the <strong>ILAW LP Generator</strong> has saved you time and made lesson planning easier,
                      please consider supporting the developer to keep this tool free and running for all DepEd teachers.
                    </p>

                    {/* GCash box */}
                    <div style={{
                      background: '#E8F5E9', border: '2px solid #1B5E20',
                      borderRadius: 12, padding: '14px 20px', marginBottom: 20,
                    }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#555', marginBottom: 4 }}>Support via GCash:</p>
                      <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#1B5E20', letterSpacing: 1 }}>
                        09333496704
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: '#333', marginTop: 2 }}>
                        Hazsher B. Munjilul
                      </p>
                    </div>

                    <p style={{ color: '#666', fontSize: 12, marginBottom: 22, fontStyle: 'italic' }}>
                      Every peso helps keep this tool free. But no pressure — your slides will be generated either way! 💚
                    </p>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                      <button
                        onClick={async () => {
                          setShowSupportPopup(false);
                          setPptError(null);
                          setPptLoading(true);
                          try {
                            const res = await fetch('/api/ppt', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                content: generatedContent,
                                teacherName: form.teacherName,
                                lessonName: form.lessonName,
                                learningArea: form.learningArea,
                                gradeSection: form.gradeSection,
                                sessions: form.sessions,
                                geminiKey: geminiKey,
                                apiKey: apiKey,
                                apiKey2: apiKey2,
                                openrouterKey: openrouterKey, // <--- ADDED: Send 2nd key
                              }),
                            });
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({}));
                              throw new Error(err.error || 'Failed to generate slides');
                            }
                            const blob = await res.blob();
                            const safeName = form.lessonName
                              ? form.lessonName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').slice(0, 60)
                              : 'ILAW_Slides';
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${safeName}_Slides.pptx`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                          } catch (err: any) {
                            setPptError(err.message || 'Failed to generate slides. Please try again.');
                          } finally {
                            setPptLoading(false);
                          }
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #1B5E20, #2E7D32)',
                          color: '#fff', border: 'none', borderRadius: 10,
                          padding: '12px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        I'll Support! Generate Slides →
                      </button>
                      <button
                        onClick={async () => {
                          setShowSupportPopup(false);
                          setPptError(null);
                          setPptLoading(true);
                          try {
                            const res = await fetch('/api/ppt', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                content: generatedContent,
                                teacherName: form.teacherName,
                                lessonName: form.lessonName,
                                learningArea: form.learningArea,
                                gradeSection: form.gradeSection,
                                sessions: form.sessions,
                                geminiKey: geminiKey,
                                apiKey: apiKey,
                                apiKey2: apiKey2,
                                openrouterKey: openrouterKey, // <--- ADDED: Send 2nd key
                              }),
                            });
                            if (!res.ok) {
                              const err = await res.json().catch(() => ({}));
                              throw new Error(err.error || 'Failed to generate slides');
                            }
                            const blob = await res.blob();
                            const safeName = form.lessonName
                              ? form.lessonName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').slice(0, 60)
                              : 'ILAW_Slides';
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${safeName}_Slides.pptx`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                          } catch (err: any) {
                            setPptError(err.message || 'Failed to generate slides. Please try again.');
                          } finally {
                            setPptLoading(false);
                          }
                        }}
                        style={{
                          background: '#f0f0f0', color: '#555', border: '1px solid #ccc',
                          borderRadius: 10, padding: '12px 22px', fontSize: 14,
                          fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Maybe Later
                      </button>
                    </div>
                  </div>
                </div>
              )}

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


          {/* ── FOOTER ── */}
          <footer className="footer">
            <p>Made with 💜 for DepEd teachers in the <strong>Philippines</strong></p>
            <p style={{ marginTop: 4 }}>
              ILAW Framework · DO 016 s.2026 · SY 2026–2027 · Created by <strong>Hazsher Briz Munjilul</strong>
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
              Every contribution helps keep this tool free and running. Salamat! 🙏
            </p>
          </div>
        </div>
      )}
    </>
  );
}