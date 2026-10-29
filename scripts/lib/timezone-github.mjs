export function timezoneGithubApi(token, fetchImpl = fetch) {
  return async (method, endpoint, body) => {
    const response = await fetchImpl(`https://api.github.com${endpoint}`, {
      method, headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Timezone merge gate: GitHub ${method} ${endpoint.split("?")[0]} returned HTTP ${response.status}`);
    // Workflow approval returns 201 without a body; dispatch returns 204.
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
}
