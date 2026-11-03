# maisexperiencia

Portal para pessoas 50+ · [maisexperiencia.com.br](https://maisexperiencia.com.br)

## Estrutura

| Pasta / ficheiro | Função |
|------------------|--------|
| `index.html` | Landing (GitHub Pages) |
| `cadastro_50.html` | Cadastro → API → área 50+ |
| `entrar_50.html` | Entrada por e-mail |
| `area_50.html` | Área 50+ (piloto) |
| `cursos_50.html` | Marketplace — cursos (inscrição) |
| `eventos_50.html` | Marketplace — eventos (inscrição) |
| `bem_estar_50.html` | Marketplace — bem-estar (inscrição) |
| `emprego_50.html` | Vagas de emprego curadas (candidatura) |
| `vagas_50.html` | Stub legado — redirecciona para `emprego_50.html` |
| `admin_inscricoes.html` | Admin — marcar inscrições pagas (chave API) |
| `cadastro_parceiro.html` | Parceiro — pedido de parceria (sem senha) |
| `ativar_parceiro.html` | Parceiro — criar senha após aprovação |
| `publicar_vaga.html` | Parceiro — enviar vaga para curadoria |
| `admin_vagas.html` | Admin — aprovar/rejeitar vagas |
| `admin_parceiros.html` | Admin — aprovar/rejeitar parceiros |
| `scripts/api-server.js` | API (cadastro, perfil, marketplace) |
| `scripts/mail.js` | E-mail transacional (nodemailer) |
| `js/` | Config, analytics GA4, helpers |
| `legal/` | Termos, privacidade e consentimento publicados no site |

```
index → cadastro_50 → area_50 → cursos_50 | eventos_50 | bem_estar_50 (inscrição)
              ↑                  emprego_50 (candidatura)
         entrar_50 (e-mail)
```

### Marketplace piloto

- `GET /api/marketplace/ofertas` — listagem pública
- `POST /api/inscricoes` — inscrição (requer cadastro)
- `PATCH /api/admin/inscricoes/:id/pagar` — marcar paga (header `X-Admin-Key`)
- Comissão plataforma: 20% (`MARKETPLACE_COMISSAO_PCT`)
- Painel: `admin_inscricoes.html` (GitHub Pages, chave em `sessionStorage`)

### Vagas (curadoria piloto)

- `POST /api/vagas` — parceiro submete vaga (`pendente`)
- `GET /api/vagas` — listagem pública (`activa`)
- Admin: `GET/PATCH /api/admin/vagas` — aprovar, rejeitar, arquivar
- `POST /api/candidaturas` — candidatura 50+ (requer cadastro)

### Parceiros (cadastro com aprovação)

- `POST /api/parceiros` — pedido sem senha (`pendente`)
- Admin: `GET/PATCH /api/admin/parceiros` — aprovar (envia e-mail) ou rejeitar
- `GET/POST /api/parceiros/ativacao` — parceiro cria senha após aprovação
- Páginas: `cadastro_parceiro.html`, `ativar_parceiro.html`, `admin_parceiros.html`

### E-mail transacional

Configure SMTP no `.env` do servidor (modelo em `.env.example`, sem senhas reais):

- Cadastro confirmado → `POST /api/contas`
- Pedido parceiro / aprovação → `POST /api/parceiros` e admin aprovar
- Inscrição recebida / paga → `POST /api/inscricoes` e admin pagar

## Teste local

```bash
npm install
npm start          # API :3000
python3 -m http.server 8080   # páginas
```

## Smoke test (produção)

```bash
npm run smoke
```

Valida: **site estático** (17 URLs) → **API pública** (health, ofertas, destaques, vagas) → **funil E2E** (cadastro → inscrição).

Variáveis opcionais: `SITE_BASE` (default `https://maisexperiencia.com.br`) · `API_BASE` (default `https://api.maisexperiencia.com.br`).

Com `ADMIN_API_KEY` no ambiente, também testa marcar inscrição como paga.

## Verificar consistência do match (50+ ↔ parceiro)

```bash
npm run verify:match            # escolhe uma vaga activa com candidato
npm run verify:match -- <vagaId>  # vaga específica
```

Prova que a % de compatibilidade vista pelo 50+ (`GET /api/vagas/:id/match`) é
**exactamente** a mesma que o parceiro vê em "Top candidatos"
(`GET /api/parceiros/publicacoes/:id/alinhamento?escopo=candidatos`): ambos
partilham a chave de cache `email + vagaId + inputHash` em `match_candidato_cache`.

Requer `MONGODB_URI` e `OPENROUTER_API_KEY` no `.env`.

## GA4

1. Crie propriedade em [Google Analytics](https://analytics.google.com)
2. Cole o ID em `js/site-config.js` → `ga4MeasurementId: "G-XXXXXXXXXX"`
3. Eventos: `cta_cadastro_clique`, `cadastro_sucesso`, `entrar_sucesso`, `area_50_visita`

## O que fica fora do repositório

Senhas, chave de admin, token do Telegram, endereço do banco, IP do servidor, SSH, DNS e documentos internos (planos, finanças, captação) ficam só na máquina, em `.env`, `deploy/` e `file/`. Essas pastas não entram no Git.

Páginas estáticas: **git push** → GitHub Pages. A API pública continua em `https://api.maisexperiencia.com.br`.
