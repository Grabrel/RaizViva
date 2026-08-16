# Instituto Raiz Viva — Simulação Acadêmica v2.1

Home page criada exclusivamente para uma atividade universitária sobre comunicação organizacional e modelo PESO.

## Aviso inicial obrigatório

Antes de visualizar o site, o visitante encontra uma tela em destaque informando que:

- o site é uma simulação;
- foi criado apenas para uma atividade universitária;
- nenhuma parceria, doação, fala ou apoio deve ser interpretado como real;
- nomes, imagens e situações envolvendo figuras públicas são usados apenas como elementos de um cenário acadêmico fictício.

O acesso só é liberado após o botão:

**“Entendo que seja uma simulação para uma atividade universitária, desejo seguir”**

Depois do acesso, um selo permanente de **SIMULAÇÃO ACADÊMICA** continua visível no topo da página.

## Cenário fictício com Podpah

A página inclui uma seção acadêmica simulando:

- apoio dos apresentadores do Podpah à campanha;
- uma grande doação fictícia;
- uma menção fictícia durante o episódio 676 com Lucas Inutilismo.

A própria seção informa novamente que esses elementos não são fatos reais.

## Imagem

A imagem fornecida para a atividade está em:

`assets/podpah-simulacao.png`

## Publicação no GitHub Pages

Envie para a raiz do repositório:

- `index.html`
- `style.css`
- `app.js`
- `README.md`
- `.nojekyll`
- pasta `assets`

Depois:

Settings → Pages → Deploy from a branch → main → /(root)

## Observação

Este projeto não representa uma ONG real e não solicita pagamentos reais.


## Correção v2.1

Corrigido o controle visual da tela de aviso inicial. O CSS agora respeita explicitamente o atributo `hidden`, permitindo que o botão de aceite revele a home da simulação.


## v2.2 — imagem incorporada no HTML

A fotografia usada na seção do cenário fictício foi incorporada diretamente ao `index.html` em formato Data URI.

Isso elimina dependência de:

- pasta `assets`;
- nome exato do arquivo;
- caminhos relativos no GitHub Pages.

Para publicar esta versão, `index.html`, `style.css` e `app.js` já são suficientes para exibir a imagem.
