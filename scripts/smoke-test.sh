#!/usr/bin/env bash
# Smoke test: site estático + API pública + funil E2E (cadastro → inscrição)
set -euo pipefail

SITE="${SITE_BASE:-https://maisexperiencia.com.br}"
API="${API_BASE:-https://api.maisexperiencia.com.br}"
EMAIL="smoke.$(date +%s)@example.com"
NOME="Smoke Test"
ORIGIN="${SITE}"

SITE_PATHS=(
  /
  /index.html
  /entrar.html
  /cadastro_50.html
  /entrar_50.html
  /recuperar_senha.html
  /redefinir_senha.html
  /area_50.html
  /emprego_50.html
  /cursos_50.html
  /eventos_50.html
  /bem_estar_50.html
  /cadastro_parceiro.html
  /entrar_parceiro.html
  /area_parceiro.html
  /admin.html
  /js/app-shell.js
  /js/site-config.js
  /css/app-page.css
)

check_url() {
  local label="$1"
  local url="$2"
  local code
  code=$(curl -sf -o /dev/null -w "%{http_code}" "$url")
  if [[ "$code" != "200" && "$code" != "301" && "$code" != "302" ]]; then
    echo "FALHA [$code] $label — $url" >&2
    exit 1
  fi
  echo "  OK [$code] $label"
}

echo "==> Site estático ($SITE)"
for path in "${SITE_PATHS[@]}"; do
  check_url "$path" "$SITE$path"
done

echo "==> API pública ($API)"
HEALTH=$(curl -sf "$API/api/health")
echo "$HEALTH" | grep -q '"ok":true'
echo "  OK /api/health"
echo "$HEALTH" | grep -q '"smtp":true' || echo "  AVISO smtp=false"
echo "$HEALTH" | grep -q '"openrouter":true' || echo "  AVISO openrouter=false"

OFERTAS=$(curl -sf "$API/api/marketplace/ofertas")
echo "$OFERTAS" | grep -q '"ok":true'
echo "  OK /api/marketplace/ofertas"

DESTAQUES=$(curl -sf "$API/api/destaques")
echo "$DESTAQUES" | grep -qE '"ok"|"destaques"'
echo "  OK /api/destaques"

VAGAS=$(curl -sf "$API/api/vagas")
echo "$VAGAS" | grep -q '"ok":true'
echo "  OK /api/vagas"

OFERTA_ID=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(d['ofertas'][0]['_id'])" <<< "$OFERTAS")

echo "==> Funil E2E (cadastro → inscrição)"

echo "  Cadastro POST"
CAD=$(curl -sf -X POST "$API/api/contas" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d "{\"nome\":\"$NOME\",\"email\":\"$EMAIL\",\"telefone\":\"51999990000\",\"dataNascimento\":\"1965-06-15\",\"senha\":\"Abc123\",\"consentimentoDados\":true}")
echo "$CAD" | grep -q '"ok":true'

echo "  Entrar POST"
ENTRAR=$(curl -sf -X POST "$API/api/contas/entrar" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d "{\"email\":\"$EMAIL\",\"senha\":\"Abc123\"}")
echo "$ENTRAR" | grep -q '"ok":true'
TOKEN=$(python3 -c "import json,sys; print(json.load(sys.stdin)['token'])" <<< "$ENTRAR")

echo "  Perfil GET"
ENC_EMAIL=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$EMAIL'))")
PERFIL=$(curl -sf "$API/api/contas/perfil?email=$ENC_EMAIL")
echo "$PERFIL" | grep -q "$EMAIL"

echo "  Inscrição POST ($OFERTA_ID)"
INS=$(curl -sf -X POST "$API/api/inscricoes" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"ofertaId\":\"$OFERTA_ID\"}")
echo "$INS" | grep -q '"ok":true'

if [[ -n "${ADMIN_API_KEY:-}" ]]; then
  echo "  Admin marcar paga"
  INSC_ID=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(d['id'])" <<< "$INS")
  PAG=$(curl -sf -X PATCH "$API/api/admin/inscricoes/$INSC_ID/pagar" \
    -H "X-Admin-Key: $ADMIN_API_KEY")
  echo "$PAG" | grep -q '"ok":true'
fi

echo "OK — site (${#SITE_PATHS[@]} URLs) + API pública + funil E2E ($EMAIL)"
