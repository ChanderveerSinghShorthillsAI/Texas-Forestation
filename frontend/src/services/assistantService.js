const BASE_URL = process.env.REACT_APP_BASE_URL || 'http://localhost:8000';

async function sendQuery({ countyName, longitude, latitude, userQuery, username }) {
  const res = await fetch(`${BASE_URL}/api/assistant/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ county_name: countyName, longitude, latitude, user_query: userQuery, username })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Assistant query failed: ${txt}`);
  }
  return res.json();
}

async function getHistory(username) {
  const res = await fetch(`${BASE_URL}/api/assistant/history/${encodeURIComponent(username)}`);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Fetch history failed: ${txt}`);
  }
  return res.json();
}

async function clearHistory(username) {
  const res = await fetch(`${BASE_URL}/api/assistant/history/${encodeURIComponent(username)}`, { method: 'DELETE' });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Clear history failed: ${txt}`);
  }
  return res.json();
}

export const assistantService = {
  sendQuery,
  getHistory,
  clearHistory,
};


