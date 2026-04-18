const API = {
  base: '/api',
  token: null,
  usuario: null,

  async req(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (this.token) opts.headers['Authorization'] = `Bearer ${this.token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(this.base + path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || 'Erro na requisição');
    return data;
  },

  get(path) { return this.req('GET', path); },
  post(path, body) { return this.req('POST', path, body); },
  put(path, body) { return this.req('PUT', path, body); },
  delete(path) { return this.req('DELETE', path); },

  async login(email, senha, empresa_id = 'global') {
    const data = await this.post('/auth/login', { email, senha, empresa_id });
    this.token = data.token;
    this.usuario = data.usuario;
    localStorage.setItem('token', data.token);
    localStorage.setItem('usuario', JSON.stringify(data.usuario));
    return data;
  },

  logout() {
    this.token = null;
    this.usuario = null;
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
  },

  restoreSession() {
    const token = localStorage.getItem('token');
    const usuario = localStorage.getItem('usuario');
    if (token && usuario) {
      this.token = token;
      this.usuario = JSON.parse(usuario);
      return true;
    }
    return false;
  }
};
