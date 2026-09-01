# AUVP Partners — landing page

Página de qualificação do AUVP Partners, o hub de negócios e relações corporativas
da AUVP Capital. Site estático, sem build e sem dependências de runtime: HTML, CSS e
JavaScript de módulos nativos. O escopo de negócio está em `AUVP_Partners_Projeto.md`.

## Direção

Escuro do topo ao rodapé, tipografia leve e grande — Inter, sem serifada em nenhum
ponto —, fios de 1px no lugar de caixas e um único acento (verde) reservado a estados
ativos, marcadores e às rotas do globo. O menu se recolhe numa pílula flutuante ao
sair da hero.
A peça interativa é um globo WebGL desenhado do zero — sem three.js — que atravessa
o hero e a seção "A rede": o mesmo canvas sai de um planeta cortado na base da tela
e se recompõe como esfera navegável quando a rede entra em cena.

O globo responde a: arrastar (com inércia), hover nas praças (rótulo com a função da
cidade), filtro por frente e seleção de corredor (gira até enquadrar a rota e acende
o arco). Sem WebGL, o palco cai para um horizonte estático em CSS.

## Estrutura

```
index.html                  markup completo da página
404.html                    página de erro (estilo embutido, sem dependências)
assets/css/site.css         folha única — tokens, seções, responsivo
assets/js/main.js           scroll, revelação, acordeão, etapas, formulário
assets/js/globe.js          renderer WebGL (atmosfera, terra, corredores, hubs, estrelas)
assets/js/network.js        praças e corredores (dados editáveis)
assets/js/engagement.js     medidor do peso da taxa de setup (curva + número-herói)
assets/js/i18n.js           motor de idiomas e seletor do menu
assets/js/i18n/*.js         dicionários (pt traz só os textos gerados por JS)
assets/js/land-dots.js      máscara de terra gerada (base64 Int16, ~4.700 pontos)
assets/brand/               logos oficiais da AUVP Capital (SVG, versões brancas)
assets/fonts/               Inter auto-hospedada (SIL OFL 1.1)
assets/og.png               imagem de compartilhamento (1200x630)
tools/build-land-dots.mjs   gerador da máscara de terra
.github/workflows/pages.yml publicação automática no GitHub Pages
```

## Rodar localmente

Precisa ser servido por HTTP (a página usa módulos ES):

```sh
python3 -m http.server 8080
# http://localhost:8080
```

## Idiomas

A página existe em português, inglês, espanhol e chinês simplificado. O idioma
inicial vem de `localStorage` e, na primeira visita, do `navigator.language`; o
seletor fica no menu, e a escolha persiste.

**O português é a fonte.** Os textos vivem no próprio `index.html`, marcados com
`data-i18n="chave"` (texto), `data-i18n-html` (trecho com marcação interna) e
`data-i18n-attr="atributo:chave"`. Na inicialização o motor fotografa esse conteúdo,
e voltar ao português é restaurar a foto — não há um `pt.js` duplicando o HTML.
`assets/js/i18n/pt.js` guarda apenas o que o JS escreve: nomes e funções das praças,
descrições dos corredores, mensagens de erro do formulário e as palavras de escala
dos valores.

Os outros idiomas chegam por `import()` sob demanda, então quem lê em português não
baixa tradução nenhuma. **Ao acrescentar um texto novo, dê a ele uma chave no HTML e
acrescente essa chave em `en.js`, `es.js` e `zh.js`** — o que faltar cai no português.

Números e datas seguem o locale do idioma (`18.200 km` em pt, `18,200 km` em en). Os
valores em reais usam as palavras de escala de cada idioma, e o chinês conta em 万 e
亿; as marcas do eixo do medidor saem da notação compacta do `Intl`, que já resolve
`mi/bi`, `M/B` e `万/亿`. A Inter não tem CJK: o chinês cai para a fonte de sistema,
declarada na pilha de `--sans`.

## Marca

As logos em `assets/brand/` vieram do design system da AUVP
(https://produtosauvp.github.io/central/design-system → Fundamentos → Marca & Logos;
arquivos-fonte em `armandocustodio-ds/designsystemauvp`). São as versões brancas, para
fundo escuro. O único ajuste foi remover o manifesto c2pa embutido, que respondia por
cerca de 80% do peso de cada arquivo — os traçados estão intactos. Para atualizar,
baixe a versão nova do design system e repita a limpeza.

A assinatura da página é a logo da AUVP Capital seguida de um fio e da palavra
*Partners*, marcando a relação de endosso entre a matriz e a iniciativa.

## Serviços e rede

A esteira tem seis frentes — *Institutional Relations*, *Business Connections*,
*International*, *Family Office*, *Soft Landing* e *Market Intelligence*. Os nomes
são de produto e ficam em inglês nos quatro idiomas; o que traduz é a descrição.

## Editar a rede

`assets/js/network.js` concentra praças (`HUBS`), serviços (`SERVICES`) e corredores
(`ROUTES`). Cada rota aponta duas praças e o índice do serviço que a percorre; os
índices são resolvidos por `id`, então reordenar `HUBS` não quebra nada. As distâncias
exibidas são ortodrômicas, calculadas em tempo de execução.

A navegação da seção é um índice: cada serviço é uma linha com o número, o nome e a
quantidade de corredores; abrir uma linha filtra o globo e revela as rotas daquele
serviço. Nenhuma linha aberta significa o globo com a malha inteira. Só entra no
índice o serviço que de fato percorre corredores — *Market Intelligence* atravessa
todas as frentes e não tem rota própria, então a lista é derivada de `ROUTES`, não
fixada à mão.

## O medidor do engajamento

A seção de engajamento traz um número vivo: o peso da taxa de setup na operação,
que é só `20.000 / valor` — nenhum percentual de success fee é simulado, porque
ele é definido em contrato, caso a caso. A curva usa eixo x logarítmico (R$ 1 mi a
R$ 1 bi) e y linear (0 a 2%), e o `viewBox` do SVG acompanha o tamanho real em
pixels, de modo que fontes, espessuras e o marcador saem no tamanho pedido em
qualquer largura. Arrastar sobre o gráfico também move o valor; o `input[type=range]`
continua sendo o controle acessível por teclado.

Se a taxa de setup mudar, `SETUP` em `assets/js/engagement.js` é o único ponto a
ajustar — o topo do eixo y (`TOP`) é o peso dela em uma operação de R$ 1 milhão.

## Formulário

O envio é validado no cliente e, por padrão, apenas confirma na tela — não há back-end.
Para ligar a um endpoint, adicione o atributo no formulário:

```html
<form class="form" data-form data-endpoint="https://exemplo.com/aplicacoes" novalidate>
```

O payload vai como JSON com os campos `empresa`, `setor`, `faturamento`, `servico`,
`dor`, `nome`, `cargo`, `email` e `telefone`.

## Regenerar a máscara de terra

```sh
npm pack world-atlas@2 && tar xzf world-atlas-2.0.2.tgz
node tools/build-land-dots.mjs package/land-50m.json 18000 > assets/js/land-dots.js
```

## Publicação (GitHub Pages)

O repositório já vem com o workflow `.github/workflows/pages.yml`, que publica a
cada push na `main` (e também sob demanda, pelo botão *Run workflow*). Ele monta um
diretório `_site` apenas com `index.html`, `404.html` e `assets/` — os documentos
internos do repositório, como `AUVP_Partners_Projeto.md`, **não** vão para o ar.

Para ligar, uma única vez:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Leve a branch para a `main` (merge do PR ou merge direto).
3. Acompanhe em **Actions → Publicar no GitHub Pages**. Ao final, a URL aparece no
   próprio job e em Settings → Pages.

A página fica em `https://produtosauvp.github.io/auvp_partners/`. Todos os caminhos
são relativos, então o site funciona tanto em subpasta quanto na raiz de um domínio.

### Domínio próprio

Em **Settings → Pages → Custom domain**, informe o domínio (ex.: `partners.auvp.com.br`)
e marque *Enforce HTTPS*. No DNS, crie um `CNAME` de `partners` apontando para
`produtosauvp.github.io`. O GitHub grava um arquivo `CNAME` no repositório — se ele
for criado, acrescente a linha `cp CNAME _site/` no passo *Montar o diretório de
publicação*, senão o domínio se perde na publicação seguinte.

### Antes de divulgar o link

- `og:image` está com caminho relativo. Assim que a URL final existir, troque as tags
  `og:image` e acrescente `og:url` e `<link rel="canonical">` com o endereço absoluto —
  o LinkedIn não resolve caminhos relativos de forma confiável.
- A imagem de compartilhamento (`assets/og.png`, 1200×630) é uma captura do hero;
  regenere se a headline mudar.

## Pendências de conteúdo

Dados institucionais do rodapé (razão social, CNPJ, endereço e canais de contato)
estão como texto genérico e precisam ser preenchidos antes de publicar.
