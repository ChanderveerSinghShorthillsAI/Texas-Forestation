import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { assistantService } from '../../services/assistantService';

const panelStyle = {
  position: 'fixed',
  top: 0,
  right: 0,
  width: '30%',
  height: '100vh',
  background: '#0b1220',
  color: 'white',
  borderLeft: '1px solid #1f2937',
  zIndex: 3000,
  display: 'flex',
  flexDirection: 'column'
};

export default function AssistantPanel({
  isOpen,
  onClose,
  username,
  countyName,
  coordinates,
  onChooseCounty,
  onClearSelection,
}) {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const streamingRef = useRef('');
  const [phase, setPhase] = useState('init'); // init -> awaiting_county -> awaiting_coords -> ready
  const announcedCoordsRef = useRef(null);
  const savedCoordsRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !username) return;
    let mounted = true;
    (async () => {
      try {
        const res = await assistantService.getHistory(username);
        if (!mounted) return;
        const msgs = (res.interactions || []).flatMap(i => ([{ role: 'user', text: i.q }, { role: 'assistant', text: i.a }]));
        setHistory(msgs.length ? msgs : [{ role: 'assistant', text: 'Please type a county name.' }]);
        // also read last saved coords as a fallback for continuity
        try {
          const key = `assistant:lastCoords:${username}`;
          const saved = localStorage.getItem(key);
          if (saved) {
            const arr = JSON.parse(saved);
            if (Array.isArray(arr) && arr.length === 2) savedCoordsRef.current = arr;
          }
        } catch (_) {}
        // derive phase: if user has prior history, do not prompt for coords; otherwise use props
        if (msgs.length > 0) {
          setPhase('ready');
        } else if (countyName && coordinates) {
          setPhase('ready');
        } else if (countyName && !coordinates) {
          setPhase('awaiting_coords');
        } else {
          setPhase('awaiting_county');
        }
      } catch {
        setHistory([{ role: 'assistant', text: 'Please type a county name.' }]);
        setPhase('awaiting_county');
      }
    })();
    return () => { mounted = false; };
  }, [isOpen, username, countyName, coordinates]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [history]);

  // Note: clear typed command is handled synchronously in handleSend

  // When coordinates are selected after county step, announce readiness
  useEffect(() => {
    if (!coordinates || !Array.isArray(coordinates)) return;
    const [lng, lat] = coordinates;
    const key = `${lng},${lat}`;
    if (announcedCoordsRef.current === key) return;
    if (phase === 'awaiting_coords') {
      announcedCoordsRef.current = key;
      const countyText = countyName ? `${countyName} County` : 'the selected county';
      setHistory(h => [
        ...h,
        { role: 'assistant', text: `Great! You selected coordinates ${lng.toFixed(4)}, ${lat.toFixed(4)} in ${countyText}. Now you can query for this county and coordinates.` }
      ]);
      setPhase('ready');
    }
  }, [coordinates, phase, countyName]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const question = input.trim();
    setHistory(h => [...h, { role: 'user', text: question }]);
    setInput('');

    // Handle reset commands BEFORE county selection logic
    const qLower = question.toLowerCase();
    const saysClear = /\bclear( chat)?\b/.test(qLower);
    if (saysClear) {
      if (username) {
        try { await assistantService.clearHistory(username); } catch (_) {}
      }
      setHistory([{ role: 'assistant', text: 'Please type a county name.' }]);
      setPhase('awaiting_county');
      announcedCoordsRef.current = null;
      return;
    }
    // change location command has been removed from chatbot

    // If no county yet, treat this as county selection step
    if (!countyName && onChooseCounty) {
      onChooseCounty(question);
      setHistory(h => [...h, { role: 'assistant', text: 'Great! Now click on the map to select coordinates.' }]);
      setPhase('awaiting_coords');
      return;
    }

    // If county exists but no coordinates yet, try fallback from saved coords
    const coordsToUse = (coordinates && Array.isArray(coordinates)) ? coordinates : savedCoordsRef.current;
    if (countyName && !coordsToUse) {
      setHistory(h => [...h, { role: 'assistant', text: 'Please click on the map to select coordinates, then ask your question.' }]);
      return;
    }

    const [lng, lat] = coordsToUse;
    setLoading(true);
    try {
      const res = await assistantService.sendQuery({
        countyName,
        longitude: lng,
        latitude: lat,
        userQuery: question,
        username
      });
      const ans = res.natural_response || res.naturalResponse || JSON.stringify(res);
      setHistory(h => [...h, { role: 'assistant', text: ans }]);
    } catch (e) {
      setHistory(h => [...h, { role: 'assistant', text: 'Error: ' + e.message }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!username) return;
    await assistantService.clearHistory(username);
    setHistory([{ role: 'assistant', text: 'Please type a county name.' }]);
    setPhase('awaiting_county');
    announcedCoordsRef.current = null;
    // Clear any existing county highlight and coordinates in the map
    if (onClearSelection) {
      try { onClearSelection(); } catch (_) {}
    }
  };

  if (!isOpen) return null;

  return (
    <div style={panelStyle}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700 }}>Ask Assistant</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleClear} style={{ background: '#111827', color: 'white', border: '1px solid #374151', padding: '6px 10px', borderRadius: 6 }}>Clear</button>
          <button onClick={onClose} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 10px', borderRadius: 6 }}>Close</button>
        </div>
      </div>
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {history.map((m, idx) => (
          <div key={idx} style={{ marginBottom: 12, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '80%',
              padding: '12px 14px',
              borderRadius: 12,
              background: m.role === 'user' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : 'linear-gradient(135deg, #0b1220, #0e1726)',
              border: m.role === 'user' ? '1px solid rgba(255,255,255,0.2)' : '1px solid #1f2937',
              whiteSpace: 'pre-wrap',
              color: m.role === 'user' ? 'white' : '#e5e7eb',
              boxShadow: '0 6px 20px rgba(0,0,0,0.25)'
            }}>
              <div style={{ lineHeight: 1.6 }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ node, ...props }) => (
                      <a
                        {...props}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#93c5fd', textDecoration: 'underline' }}
                      />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul {...props} style={{ paddingLeft: '1.2rem', margin: '0.25rem 0' }} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol {...props} style={{ paddingLeft: '1.2rem', margin: '0.25rem 0' }} />
                    ),
                    li: ({ node, ...props }) => (
                      <li {...props} style={{ marginBottom: '0.25rem' }} />
                    ),
                    strong: ({ node, ...props }) => (
                      <strong {...props} style={{ color: '#e5e7eb' }} />
                    ),
                    code: ({ node, inline, ...props }) => (
                      <code
                        {...props}
                        style={{
                          background: '#0f172a',
                          padding: inline ? '0.1rem 0.3rem' : '0.5rem',
                          borderRadius: 6,
                          border: '1px solid #1f2937',
                          display: inline ? 'inline' : 'block',
                          overflowX: 'auto'
                        }}
                      />
                    )
                  }}
                >
                  {m.text}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ color: '#9ca3af', fontSize: 12 }}>Assistant is typing…</div>
        )}
      </div>
      <div style={{ padding: 12, borderTop: '1px solid #1f2937', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={countyName ? `Ask about ${countyName}…` : 'Type a county first…'}
          style={{ flex: 1, background: '#0b1220', color: 'white', border: '1px solid #374151', borderRadius: 6, padding: '10px 12px' }}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
        />
        <button onClick={handleSend} disabled={loading || !countyName || !coordinates} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 14px', borderRadius: 6 }}>Send</button>
      </div>
      <div style={{ padding: '8px 12px', fontSize: 12, color: '#93c5fd', borderTop: '1px solid #1f2937' }}>
        {phase === 'awaiting_county' && 'Please type a county name.'}
        {phase === 'awaiting_coords' && 'Great! Now click anywhere on the map to select coordinates.'}
        {phase === 'ready' && 'Ask a question about this location.'}
      </div>
    </div>
  );
}


