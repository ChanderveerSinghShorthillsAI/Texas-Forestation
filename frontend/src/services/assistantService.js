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

/**
 * Send query with streaming response (token by token)
 * @param {Object} params - Query parameters
 * @param {Function} onToken - Callback function called for each token received
 * @returns {Promise} - Resolves when streaming is complete
 */
async function sendQueryStream({ countyName, longitude, latitude, userQuery, username }, onToken) {
  const res = await fetch(`${BASE_URL}/api/assistant/query-stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      county_name: countyName, 
      longitude, 
      latitude, 
      user_query: userQuery, 
      username 
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Assistant streaming query failed: ${txt}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      // Decode the chunk
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            
            if (data.error) {
              throw new Error(data.error);
            }
            
            if (data.done) {
              return; // Streaming complete
            }
            
            if (data.token && onToken) {
              onToken(data.token);
            }
          } catch (e) {
            console.error('Error parsing SSE message:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
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
  sendQueryStream,
  getHistory,
  clearHistory,
};


