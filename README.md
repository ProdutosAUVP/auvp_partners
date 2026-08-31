# AUVP Partners — landing page

Página de qualificação do AUVP Partners, o hub de negócios e relações corporativas
da AUVP Capital. Site estático, sem build e sem dependências de runtime: HTML, CSS e
JavaScript de módulos nativos. O escopo de negócio está em `AUVP_Partners_Projeto.md`.

## Direção

Escuro do topo ao rodapé, tipografia leve e grande, fios de 1px no lugar de caixas e
um único acento (verde) reservado a estados ativos, marcadores e às rotas do globo.
A peça interativa é um globo WebGL desenhado do zero — sem three.js — que atravessa
o hero e a seção "A rede": o mesmo canvas sai de um planeta cortado na base da tela
e se recompõe como esfera navegável quando a rede entra em cena.

O globo responde a: arrastar (com inércia), hover nas praças (rótulo com a função da
cidade), filtro por frente e seleção de corredor (gira até enquadrar a rota e acende
o arco). Sem WebGL, o palco cai para um horizonte estático em CSS.

## Estrutura

```
index.html                  markup completo da página
assets/css/site.css         folha única — tokens, seções, responsivo
assets/js/main.js           scroll, revelação, acordeão, etapas, formulário
assets/js/globe.js          renderer WebGL (atmosfera, terra, corredores, hubs, estrelas)
assets/js/network.js        praças e corredores (dados editáveis)
assets/js/land-dots.js      máscara de terra gerada (base64 Int16, ~4.700 pontos)
assets/fonts/               Inter e Instrument Serif auto-hospedadas (SIL OFL 1.1)
tools/build-land-dots.mjs   gerador da máscara de terra
```

## Rodar localmente

Precisa ser servido por HTTP (a página usa módulos ES):

```sh
python3 -m http.server 8080
# http://localhost:8080
```

## Editar a rede

`assets/js/network.js` concentra praças (`HUBS`) e corredores (`ROUTES`). Cada rota
aponta dois índices de `HUBS` e uma frente (`0` intermediação, `1` cross-border,
`2` wealth). As distâncias exibidas são ortodrômicas, calculadas em tempo de execução.

## Formulário

O envio é validado no cliente e, por padrão, apenas confirma na tela — não há back-end.
Para ligar a um endpoint, adicione o atributo no formulário:

```html
<form class="form" data-form data-endpoint="https://exemplo.com/aplicacoes" novalidate>
```

O payload vai como JSON com os campos `empresa`, `setor`, `faturamento`, `frente`,
`dor`, `nome`, `cargo`, `email` e `telefone`.

## Regenerar a máscara de terra

```sh
npm pack world-atlas@2 && tar xzf world-atlas-2.0.2.tgz
node tools/build-land-dots.mjs package/land-50m.json 18000 > assets/js/land-dots.js
```

## Pendências de conteúdo

Dados institucionais do rodapé (razão social, CNPJ, endereço e canais de contato)
estão como texto genérico e precisam ser preenchidos antes de publicar.
