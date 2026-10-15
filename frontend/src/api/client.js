const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function getToken() {
  return localStorage.getItem("access_token");
}

export function setSession(token, user) {
  localStorage.setItem("access_token", token);
  if (user) {
    localStorage.setItem("user_data", JSON.stringify(user));
  }
}

export function clearSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_data");
  localStorage.removeItem("mock_user");
}

export function getStoredUser() {
  const raw = localStorage.getItem("user_data");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = { ...(options.headers || {}) };

  const token = getToken();
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // If body is not FormData, default to application/json
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorDetail =
      (data && typeof data === "object" && (data.detail || data.message)) ||
      (typeof data === "string" ? data : `HTTP ${response.status} Error`);
    const error = new Error(errorDetail);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// --- Auth Endpoints ---
export async function apiRegister({ username, email, password }) {
  const data = await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
  setSession(data.access_token, {
    id: data.user_id,
    username: data.username,
    email: email,
  });
  return data;
}

export async function apiLogin({ username, password }) {
  const data = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setSession(data.access_token, {
    id: data.user_id,
    username: data.username,
  });
  return data;
}

export async function apiGetMe() {
  return request("/auth/me");
}

// --- Document Endpoints ---
export async function apiUploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/documents/upload", {
    method: "POST",
    body: formData,
  });
}

export async function apiGetMyDocuments() {
  return request("/documents/my-documents");
}

export async function apiSearchMaterials(query, { documentId, limit = 5 } = {}) {
  const params = new URLSearchParams({ query, limit: String(limit) });
  if (documentId != null) params.set("document_id", String(documentId));
  return request(`/rag/search?${params.toString()}`);
}

export async function apiGenerateDocumentQuestions(
  documentId,
  { count = 5, topic = null, subtopic = null } = {},
) {
  return request(`/documents/${documentId}/generate-questions`, {
    method: "POST",
    body: JSON.stringify({ count, topic, subtopic }),
  });
}

// --- Quiz Endpoints ---
export async function apiGetQuiz() {
  return request("/quiz");
}

export async function apiSubmitQuiz(answers) {
  return request("/quiz/submit", {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export async function apiGetQuizHistory() {
  return request("/quiz/history");
}

export async function apiGetStudentMastery() {
  return request("/quiz/mastery");
}

export async function apiGetDiagnosticMatrix() {
  return request("/diagnostics/matrix");
}

export async function apiGetAdaptiveQuestions(count = 10) {
  return request(`/diagnostics/adaptive-questions?count=${count}`);
}
