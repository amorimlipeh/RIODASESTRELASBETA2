(function () {
  "use strict";

  const STORAGE_KEYS = {
    usuario: "rio_usuario",
    cargo: "rio_cargo",
    empresa: "rio_empresa",
    token: "rio_token"
  };

  function getStorage(key, fallback = "") {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : value;
    } catch (_e) {
      return fallback;
    }
  }

  function setStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_e) {}
  }

  function removeStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch (_e) {}
  }

  function getSession() {
    return {
      usuario: getStorage(STORAGE_KEYS.usuario, "admin"),
      cargo: getStorage(STORAGE_KEYS.cargo, "admin"),
      empresa: getStorage(STORAGE_KEYS.empresa, "rio_das_estrelas"),
      token: getStorage(STORAGE_KEYS.token, "")
    };
  }

  function saveSession(data = {}) {
    if (data.usuario) setStorage(STORAGE_KEYS.usuario, String(data.usuario));
    if (data.cargo) setStorage(STORAGE_KEYS.cargo, String(data.cargo));
    if (data.empresa) setStorage(STORAGE_KEYS.empresa, String(data.empresa));
    if (data.token) setStorage(STORAGE_KEYS.token, String(data.token));
  }

  function clearSession() {
    removeStorage(STORAGE_KEYS.usuario);
    removeStorage(STORAGE_KEYS.cargo);
    removeStorage(STORAGE_KEYS.empresa);
    removeStorage(STORAGE_KEYS.token);
  }

  function buildAuthHeaders(extraHeaders = {}) {
    const session = getSession();

    return {
      "x-usuario": session.usuario || "admin",
      "x-cargo": session.cargo || "admin",
      "x-empresa": session.empresa || "rio_das_estrelas",
      ...(session.token ? { "x-auth-token": session.token } : {}),
      ...extraHeaders
    };
  }

  async function parseResponse(res) {
    const text = await res.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch (_e) {
      data = { raw: text };
    }

    if (!res.ok) {
      throw new Error(
        data.erro ||
        data.error ||
        data.message ||
        `Erro HTTP ${res.status}`
      );
    }

    return data;
  }

  async function apiJson(path, options = {}) {
    const headers = buildAuthHeaders({
      "Content-Type": "application/json",
      ...(options.headers || {})
    });

    const response = await fetch(path, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });

    return parseResponse(response);
  }

  async function apiFormData(path, formData, options = {}) {
    const headers = buildAuthHeaders(options.headers || {});

    const response = await fetch(path, {
      method: options.method || "POST",
      headers,
      body: formData
    });

    return parseResponse(response);
  }

  async function apiGet(path, headers = {}) {
    return apiJson(path, { method: "GET", headers });
  }

  async function apiPost(path, body = {}, headers = {}) {
    return apiJson(path, { method: "POST", body, headers });
  }

  async function apiPut(path, body = {}, headers = {}) {
    return apiJson(path, { method: "PUT", body, headers });
  }

  async function apiDelete(path, body = {}, headers = {}) {
    return apiJson(path, { method: "DELETE", body, headers });
  }

  async function login(usuario, senha, empresa = "rio_das_estrelas") {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-empresa": empresa
      },
      body: JSON.stringify({ usuario, senha })
    });

    const data = await parseResponse(response);

    if (data && data.ok) {
      saveSession({
        usuario: data.usuario || usuario,
        cargo: data.cargo || "admin",
        empresa: data.empresa || empresa,
        token: data.token || ""
      });
    }

    return data;
  }

  window.RioAPI = {
    getSession,
    saveSession,
    clearSession,
    buildAuthHeaders,
    apiJson,
    apiFormData,
    apiGet,
    apiPost,
    apiPut,
    apiDelete,
    login
  };
})();
