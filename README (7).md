# Nervi — Cofrinho.exe Web v0.7

**Nervi — Seu dinheiro. Suas escolhas. Mais tranquilidade.**

Esta pasta é a versão organizada para ser enviada diretamente para a raiz do repositório GitHub do Nervi.

## Novidades da v0.7

- nova identidade visual Nervi com símbolo/pulso em forma de `N`;
- slogan oficial da marca;
- logo adequada para modo claro e modo escuro;
- seletor claro/escuro já na tela de login;
- mensagem `Usuário incorreto.` quando o usuário não existe;
- mensagem `Senha incorreta.` quando o usuário existe e a senha não confere;
- cadastro de celular;
- recuperação de senha **somente por SMS**;
- código de 6 dígitos, expiração, limite de tentativas e token de uso único;
- campo de celular no perfil/configurações;
- preservação da base financeira v0.6: sincronização, histórico, metas, vencimentos, prioridades, foto e backup.

## Estrutura

```text
Nervi-v0.7-github/
├── index.html
├── .nojekyll
├── .gitignore
├── README.md
├── assets/
│   ├── brand/
│   │   ├── favicon.svg
│   │   ├── icon-nervi.svg
│   │   ├── logo-nervi.svg
│   │   ├── logo-nervi-dark.svg
│   │   ├── logo-nervi-compact.svg
│   │   └── logo-nervi-compact-dark.svg
│   ├── css/
│   │   └── app.css
│   └── js/
│       └── app.js
├── docs/
│   └── brand/
│       └── identidade-nervi.png
└── supabase/
    ├── README.md
    ├── sql/
    │   └── 01_nervi_sms_recovery.sql
    └── functions/
        ├── .env.example
        ├── _shared/
        │   ├── nervi.ts
        │   └── README.md
        ├── nervi-create-account/index.ts
        ├── nervi-check-username/index.ts
        ├── nervi-request-password-reset/index.ts
        ├── nervi-verify-reset-code/index.ts
        └── nervi-reset-password/index.ts
```

## Publicar no GitHub Pages

Envie **o conteúdo desta pasta** para a raiz do repositório `Nervi`. O `index.html` já aponta para `assets/css/app.css` e `assets/js/app.js`, e `.nojekyll` deve permanecer na raiz.

A parte visual/financeira pode ser publicada pelo GitHub Pages imediatamente. Para o fluxo de SMS funcionar, configure também a pasta `supabase/` conforme `supabase/README.md`.

## Onde cada imagem da marca é usada

- `logo-nervi.svg`: login/setup em modo claro;
- `logo-nervi-dark.svg`: login/setup em modo escuro;
- `logo-nervi-compact.svg`: cabeçalho interno claro;
- `logo-nervi-compact-dark.svg`: cabeçalho interno escuro;
- `icon-nervi.svg`: ícone reduzido da marca;
- `favicon.svg`: aba do navegador;
- `docs/brand/identidade-nervi.png`: prancha de referência da identidade, **não** usada como logo dentro da interface.

## Identidade

Cor de destaque principal: `#B3261E`.

Frase oficial:

> Nervi — Seu dinheiro. Suas escolhas. Mais tranquilidade.

## Recuperação de senha

O Nervi não oferece recuperação por e-mail. O único fluxo é:

```text
Celular → SMS → código de 6 dígitos → nova senha
```

A tela não confirma se um telefone está ou não cadastrado.

## Configuração do Supabase

Leia:

```text
supabase/README.md
```

Antes de publicar as Edge Functions, configure o banco e os secrets de SMS. Nunca coloque credenciais privadas do Supabase ou da Twilio dentro de `assets/js/app.js`.

## Compatibilidade

A v0.7 parte da v0.6 do Nervi Cloud e mantém o armazenamento local como cache, com `cofrinho_state` como estado sincronizado. Contas antigas podem adicionar o celular depois do login; novas contas na interface v0.7 exigem celular.
