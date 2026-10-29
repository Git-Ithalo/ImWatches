# IM Watches

Site completo de relojoaria (curadoria + catálogo institucional) construído em **Node.js + Express + EJS**, no mesmo espírito visual do site de referência (hmwatches.com.br), com um diferencial: **modelo SaaS de assinatura**, onde qualquer pessoa pode criar sua própria loja de relógios dentro da plataforma.

## Como rodar

```bash
npm install
npm start
```

Acesse **http://localhost:3000**

## O que tem pronto

- **Home** com hero (relógio ilustrado em SVG, no estilo "relógio atrás do texto" do site de referência), selo de confiança, novidades e marcas.
- **Pronta Entrega** e **Sob Encomenda**: páginas de catálogo com filtro por marca e ordenação por preço (modelo igual ao print de referência).
- Catálogo com relógios **reais** de marcas reais — Rolex, Seiko, Orient, Technos, Tissot, Citizen — com referências de modelo e preços aproximados de mercado (ver aviso abaixo).
- **Página de cada relógio** com detalhes, movimento, caixa e preço.
- **Página "Marcas"** e uma **página individual por marca**, contando a história de cada uma (Rolex, Seiko, Orient, Technos, Tissot, Citizen).
- **Planos e assinaturas** (`/planos`): 3 planos (Essencial, Profissional, Curadoria HM) com limites de catálogo diferentes.
- **Cadastro de loja (SaaS)** (`/cadastro`): qualquer visitante cria sua conta, escolhe um plano e ganha uma loja própria.
- **Login/Painel do lojista** (`/login`, `/painel`): o lojista edita o perfil da loja, adiciona/remove relógios do seu catálogo (respeitando o limite do plano) e vê estatísticas simples.
- **Vitrine pública multi-tenant** (`/loja/:slug`): cada lojista tem uma página própria, ex. `/loja/relojoaria-teste`, exibindo apenas os relógios cadastrados por ele.
- Páginas institucionais: **Sobre** e **Contato**.

## Estrutura

```
imwatches/
  server.js          -> todas as rotas (Express)
  data/
    watches.json      -> catálogo institucional IM Watches
    brands.json        -> histórico de cada marca
    plans.json          -> planos de assinatura
    stores.json          -> "banco de dados" das lojas cadastradas (gerado em runtime)
  views/               -> templates EJS
  public/css/style.css  -> estilo (paleta marfim/verde-floresta/latão, tipografia Cormorant Garamond + Work Sans)
  public/js/main.js     -> pequenas interações (favoritar)
```

## Sobre os preços e persistência

- Os preços do catálogo institucional (`data/watches.json`) são **valores de referência de mercado**, coerentes com o padrão de cada marca, mas não são uma tabela oficial em tempo real — em produção, o ideal é integrar com a tabela de preços oficial de cada distribuidor/marca.
- Este protótipo usa **arquivos JSON como banco de dados** (simples e fácil de inspecionar). Para produção real, troque `data/stores.json` por um banco de verdade (PostgreSQL, MySQL, MongoDB etc.) e use um serviço de upload de imagens (S3, Cloudinary) para fotos reais dos relógios — aqui as fotos foram substituídas por ilustrações em SVG, já que não é possível hospedar fotografias de relógios de marcas de terceiros sem licenciamento.
- Senhas são armazenadas com hash (PBKDF2 + salt), mas sessões usam armazenamento em memória — para produção, use um session store persistente (Redis, banco de dados).

## Próximos passos sugeridos

- Upload de fotos reais por loja (com um serviço de storage).
- Pagamento recorrente real dos planos (Stripe, Pagar.me, Mercado Pago).
- Painel de administrador da IM Watches para aprovar/curar lojas antes de publicar.
- Busca e filtros mais avançados (faixa de preço, tipo de movimento, tamanho de caixa).
