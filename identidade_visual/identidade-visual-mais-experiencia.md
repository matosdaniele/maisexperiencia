# Identidade visual - Mais Experiência

**Domínio:** [maisexperiencia.com.br](https://maisexperiencia.com.br)  
**Público:** pessoas 50+  
**Tagline:** *Onde experiência encontra novas oportunidades*  
**Atualização:** junho/2026  

Paleta e conceito definidos no **Canva**. Logo escolhido para o header: **variante 1** (monograma / ícone principal).

---

## 1. Nome e mensagem

| Elemento | Conteúdo |
|----------|----------|
| **Nome oficial** | Mais Experiência |
| **Tagline** | Onde experiência encontra novas oportunidades |
| **Tom** | Respeitoso, claro, inclusivo — evitar “idoso”, “terceira idade” |
| **Significado do símbolo** | “+” / mais oportunidades; experiência como valor |

---

## 2. Paleta de cores (Canva)

| Token CSS | Hex | Uso |
|-----------|-----|-----|
| `--cor-fundo` | `#f7f5f1` | Fundo do site |
| `--cor-primaria` | `#529465` | Botões, links, marca |
| `--cor-primaria-escura` | `#3d7349` | Hover, estados activos |
| `--cor-secundaria` | `#69a976` | Destaques secundários |
| `--cor-sage` | `#c3c7b0` | Bordas, divisores |
| `--cor-texto` | `#64755d` | Texto corpo, tagline |
| `--cor-texto-forte` | `#3d4a38` | Títulos |
| `--cor-accent` | `#96c689` | Destaques leves, focus |

**Modo alto contraste** (acessibilidade): fundo `#000`, texto `#fff`, acento `#ffeb3b`.

**Ficheiros:** `paleta-cores.csv` (editável) · `tokens.css` (importar no CSS)

---

## 3. Tipografia

| Papel | Fonte | Tamanho mínimo |
|-------|-------|----------------|
| UI / corpo | **Nunito Sans** (+ system-ui) | 18px (1.125rem) |
| Nome da marca (header) | Nunito Sans **700** | clamp 1.25–1.625rem |
| Tagline | Nunito Sans **400** | clamp 0.875–1rem |

Google Fonts: `Nunito Sans:400,600,700`

---

## 4. Logo

### 4.1 Ficheiros nesta pasta

| Ficheiro | Descrição |
|----------|-----------|
| `logo.png` | Logo oficial — header, favicon e destaques |
| `logo-header.svg` | Export SVG do header (referência) |
| `+ Experiência/1.svg` | Variante 1 — monograma escolhido |
| `+ Experiência/2.svg` | Variante 2 — alternativa Canva |

### 4.2 Uso no site

- **Header:** ícone à esquerda + texto “Mais Experiência” + tagline
- **Favicon:** `logo.png`
- **Caixa do logo:** fundo branco, borda `#c3c7b0`, sombra verde suave, cantos arredondados
- **Escala dentro da caixa:** ~1,55× (mobile) · ~1,6× (desktop)
- **Destaques na home:** logo do parceiro (48×48px) quando disponível

### 4.3 Boas práticas

- Manter área de respiro à volta do símbolo
- Não distorcer (sempre `object-fit: contain`)
- Não usar sobre fundos que reduzam contraste
- Versões futuras: guardar aqui `favicon.ico`, `logo-monograma.svg`

---

## 5. Header (estrutura)

```
[ caixa logo ]  Mais Experiência
                Onde experiência encontra novas oportunidades
```

Implementação: `index.html` na raiz do repositório.

---

## 6. Componentes UI (site)

| Componente | Estilo |
|------------|--------|
| **Botão primário** (`.btn-parceiro`) | Verde `#529465`, texto branco, pill (`border-radius: 999px`), min-height 48px |
| **Botão outline** | Borda verde, fundo transparente |
| **Card pilar** | Fundo branco, borda `#c3c7b0`, topo 4px `#529465`, radius 1rem |
| **Card destaque** | Igual ao pilar, topo 4px `#69a976`; ícone do pilar + título + logo parceiro |
| **Secções** | Divisor `1px solid #c3c7b0` entre blocos |
| **Páginas app** | `css/app-page.css` — fluxos 50+, parceiro e admin |

---

## 7. Personas visuais (produto)

Alinhado ao plano UX — três tons na mesma família:

| Persona | Cor sugerida |
|---------|----------------|
| Pessoa 50+ | Verde primário `#529465` + fundo `#f7f5f1` |
| Parceiro B2B | Azul acinzentado `#4a6670` |
| Admin | Teal suave `#5a8f8a` |

---

## 8. Acessibilidade

- Contraste **AA** (WCAG 2.1) nos fluxos core
- Modo **alto contraste** no header (preto / amarelo)
- Escala de fonte ajustável (5 níveis)
- Alvos de toque **≥ 44×44px**
- Logo decorativo no header: `alt=''` (nome e tagline no texto adjacente)
- Skip link para conteúdo principal

---

## 9. Fontes Canva (referência)

| Recurso | Link |
|---------|------|
| Paleta e conceito | [Canva - identidade inicial](https://www.canva.com/design/DAHLj-dAtsM/Z5wwfg8OyHzDVfFp-jR3xw/view) |
| Logos header (3 opções) | [Canva - logos header](https://www.canva.com/design/DAHLwLR02Hw/9dyjHiBHiKlAl3IFNzGgiw/view) |

Para actualizar o logo: substituir `logo.png` na raiz do projeto (cópia canónica também em `identidade_visual/logo.png`).

---

## 10. Conteúdo da pasta

```
identidade_visual/
  identidade-visual-mais-experiencia.md
  identidade-visual-mais-experiencia.pdf
  identidade-visual-print.html
  logo.png
  logo-header.svg
  paleta-cores.csv
  tokens.css
  + Experiência/
    1.svg
    2.svg
```

---

*Mais Experiência — maisexperiencia.com.br*
