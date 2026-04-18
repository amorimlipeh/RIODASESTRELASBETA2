# 🌟 Sistema Logístico de Operação — Rio das Estrelas 💫

> Sistema WMS multi empresarial de alto nível — estoque, logística, pedidos, separação e muito mais.

## 🚀 Stack

- **Backend:** Node.js + Express (arquitetura modular)
- **Banco:** SQLite (isolado por empresa) — escalável para PostgreSQL
- **Frontend:** HTML5 + CSS3 + JS puro (sem framework — performance máxima)
- **Auth:** JWT com cargos e permissões por módulo
- **Multi-tenant:** cada empresa tem seu banco isolado

## 📦 Módulos

| Módulo | Status |
|---|---|
| Dashboard | ✅ |
| Produtos | ✅ |
| Estoque (entrada/saída/ajuste) | ✅ |
| Buscar Estoque | ✅ |
| Endereços WMS | ✅ |
| Mapa WMS Visual | ✅ |
| Movimentações | ✅ |
| Pedidos | ✅ |
| Separação | ✅ |
| Conferência | ✅ |
| Contêineres | ✅ |
| Importação | ✅ |
| Notificações | ✅ |
| Usuários + Cargos | ✅ |
| Logs por usuário | ✅ |
| Painel Admin | ✅ |
| Painel Desenvolvedor | ✅ |
| Área do Cliente | ✅ |
| IA Assistente | ✅ |
| Configurações | ✅ |
| Multi Empresas | ✅ |

## 🏗️ Estrutura WMS

```
07 ruas × 140 posições × 07 andares = 6.860 endereços
Padrão: RR-PPP-A-1 (ex: 05-001-3-1)
```

## ▶️ Rodar localmente

```bash
cd backend
npm install
npm start
```

Acesse: http://localhost:3000

**Credenciais padrão:**
- Email: `admin@sistema.com`
- Senha: `admin123`

## 🔐 Cargos

- **Desenvolvedor** — Controle total + multi empresas
- **Administrador** — Gestão geral
- **Supervisor** — Operação + relatórios
- **Operador** — Estoque + movimentações
- **Conferente** — Conferência + separação
- **Cliente** — Área do cliente

## 📡 API

| Endpoint | Descrição |
|---|---|
| `POST /api/auth/login` | Login |
| `GET /api/dashboard` | Dados do dashboard |
| `GET/POST /api/produtos` | CRUD produtos |
| `GET /api/estoque` | Estoque atual |
| `POST /api/estoque/movimentar` | Movimentação |
| `GET /api/estoque/movimentacoes` | Histórico |
| `GET/POST /api/enderecos` | Endereços WMS |
| `POST /api/enderecos/seed` | Gerar endereços |
| `GET /api/enderecos/mapa` | Mapa por rua |
| `GET/POST /api/pedidos` | Pedidos |
| `GET/POST /api/usuarios` | Usuários |
| `GET /api/logs` | Logs |
| `GET /api/notificacoes` | Notificações |
| `GET/POST /api/empresas` | Multi empresas |

---

Built with ❤️ — Sistema Logístico de Operação v2.0
