# Nexun — Consolidação, Análise e Auditoria de Relatórios

Plataforma web para consultar dados do ERP configurado (via `DbExplorerSP.executeQuery`),
consolidar vendas por fornecedor/operação e **cruzar múltiplos relatórios do mesmo
fornecedor** para detectar divergências de valores e notas ausentes — sem exigir
alteração de código para novos fornecedores ou relatórios.

## Sumário

- [Descrição](#descrição)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração / Variáveis de ambiente](#configuração--variáveis-de-ambiente)
- [Armazenamento de dados](#armazenamento-de-dados)
- [Execução em desenvolvimento](#execução-em-desenvolvimento)
- [Build de produção](#build-de-produção)
- [API](#api)
- [Integração Sankhya](#integração-sankhya)
- [Cadastro de relatórios](#cadastro-de-relatórios)
- [Como executar uma query](#como-executar-uma-query)
- [Como realizar um cruzamento](#como-realizar-um-cruzamento)
- [Sincronização agendada](#sincronização-agendada)
- [Testes](#testes)
- [Troubleshooting](#troubleshooting)

## Descrição

O sistema permite:

- cadastrar **relatórios** (queries SQL executadas via DbExplorer da Sankhya);
- validar que cada query retorna as colunas obrigatórias (`FORNECEDOR`, `OPERACAO`,
  `NF`, `VLR_LIQUIDO`, `QUANTIDADE` e, opcionalmente, `VLR_BRUTO`) antes de permitir salvá-la;
- executar relatórios (individualmente ou todos os ativos de uma vez) e normalizar
  o resultado para um modelo interno (`ReportRecord`) independente do formato bruto
  da Sankhya;
- consolidar valores por fornecedor e por operação em um Dashboard;
- **cruzar dois ou mais relatórios do mesmo fornecedor**, comparando nota a nota
  (chave = `FORNECEDOR + NF + OPERACAO`) o valor líquido, valor bruto e quantidade,
  com tolerância monetária configurável, sinalizando divergências e notas ausentes;
- gerar alertas automáticos no Dashboard sempre que um fornecedor tiver mais de um
  relatório e os resultados divergirem.

Nenhuma lógica é hardcoded para um fornecedor ou relatório específico — o sistema
detecta fornecedores, relatórios e operações dinamicamente a partir dos dados.

## Stack

**Backend:** Node.js, Express, TypeScript, Zod, Axios.
**Frontend:** Astro, TypeScript, Tailwind CSS (build estático, sem framework de UI).
**Armazenamento:** **arquivos JSON** (decisão deste projeto — sem banco relacional).
Cada escrita sobrescreve o arquivo inteiro, com gravação atômica (arquivo
temporário + rename) para nunca corromper os dados em caso de falha no meio da
escrita.

## Arquitetura

```
/
├── backend/
│   └── src/
│       ├── controllers/       # HTTP in/out
│       ├── services/          # regra de negócio (normalização, comparação, dashboard)
│       ├── repositories/      # JsonRepository (armazenamento em JSON)
│       ├── routes/
│       ├── middlewares/       # validate (Zod), errorHandler
│       ├── integrations/
│       │   └── sankhya/       # SankhyaAuthService, SankhyaClient, SankhyaDbExplorerService, Adapter
│       ├── utils/
│       ├── app.ts
│       └── server.ts
├── frontend/
│   └── src/
│       ├── components/        # StatusBadge, MetricCard, EmptyState
│       ├── layouts/           # MainLayout (sidebar + header)
│       ├── pages/             # Dashboard, Relatórios, Cruzar, Fornecedor, Execuções, Config
│       └── services/api.ts    # único ponto de contato com o backend
├── shared/
│   ├── types/                 # Report, ReportRecord, ComparisonResult, etc.
│   └── schemas/                # Zod schemas compartilhados
└── package.json                # npm workspaces (backend + frontend)
```

Fluxo de dados:

```
Controller → Service → Repository (JSON)
Service → Sankhya Integration → API Sankhya
```

O frontend **nunca** chama a Sankhya diretamente — apenas a API própria do backend
(`/api/...`), que mantém as credenciais Sankhya exclusivamente no servidor.

## Pré-requisitos

- Node.js 20+
- npm 10+

## Instalação

Este projeto usa **npm workspaces** (raiz + `backend/` + `frontend/`) — isso é
necessário para que `shared/` resolva dependências como `zod` corretamente
(a resolução de módulos do Node sobe por diretórios ancestrais, e o workspace
faz o hoisting do `node_modules` para a raiz, ancestral comum de `backend/` e
`shared/`).

```bash
# na raiz do projeto
npm install
```

## Configuração / Variáveis de ambiente

```bash
cp backend/.env.example backend/.env
```

Preencha `backend/.env`:

```env
SANKHYA_API_URL=https://api.sankhya.com.br/authenticate
SANKHYA_SERVICE_URL=https://api.sankhya.com.br/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json
SANKHYA_X_TOKEN=
CLIENT_ID=
CLIENT_SECRET=
GRANT_TYPE=client_credentials

PORT=3026
DATA_DIR=./data
```

> ⚠️ **`SANKHYA_X_TOKEN`, `CLIENT_ID` e `CLIENT_SECRET` nunca são expostos ao
> frontend.** Eles só existem no processo do backend (`process.env`), nunca em
> uma resposta HTTP, log, ou arquivo versionado. `.env` está no `.gitignore`.

### ⚠️ Formato da integração Sankhya pendente de confirmação

Este projeto implementa a integração Sankhya (`SankhyaAuthService`,
`SankhyaClient`, `SankhyaDbExplorerService`, `SankhyaAdapter`) com base no
formato usualmente documentado do `DbExplorerSP.executeQuery` e do endpoint de
autenticação — mas **alguns detalhes exatos (nome de campos do payload, se o
X-Token vai em header customizado ou dentro do corpo, o TTL real do token,
etc.) estão marcados no código com o comentário `CONFIRMAR COM DOC OFICIAL`** e
precisam ser validados contra a documentação oficial da Sankhya ou uma chamada
de exemplo antes de ir para produção. Os arquivos afetados:

- `backend/src/integrations/sankhya/SankhyaAuthService.ts`
- `backend/src/integrations/sankhya/SankhyaClient.ts`
- `backend/src/integrations/sankhya/SankhyaDbExplorerService.ts`
- `backend/src/integrations/sankhya/sankhya.types.ts`

## Armazenamento de dados

**Não há banco de dados relacional.** Os dados vivem em arquivos JSON dentro de
`backend/data/` (caminho configurável via `DATA_DIR`):

| Arquivo             | Conteúdo                                   |
|----------------------|---------------------------------------------|
| `reports.json`       | Relatórios cadastrados                     |
| `executions.json`    | Histórico de execuções                     |
| `records.json`       | Registros normalizados de cada execução    |
| `comparisons.json`   | Resultados de cruzamentos persistidos       |

A cada escrita, o arquivo correspondente é **sobrescrito por completo** — nunca
há patch parcial em disco. Para evitar corrupção em caso de falha no meio da
escrita, o conteúdo é gravado primeiro em um arquivo temporário e só então
renomeado por cima do arquivo final (operação atômica no mesmo filesystem).
Essa lógica está isolada em `backend/src/repositories/JsonRepository.ts` —
trocar por um banco relacional no futuro não exige alterar nenhuma regra de
negócio, apenas essa camada.

## Execução em desenvolvimento

Em dois terminais:

```bash
# terminal 1 — backend (porta 3026)
npm run dev:backend

# terminal 2 — frontend (porta 3027)
npm run dev:frontend
```

O dev server do Astro faz proxy de `/api/*` para `http://localhost:3026`
(configurável via `BACKEND_URL`).

## Build de produção

```bash
npm run build:backend   # gera backend/dist
npm run build:frontend  # gera frontend/dist (site estático)
```

Backend:

```bash
cd backend && npm start   # node dist/backend/src/server.js
```

Frontend: sirva `frontend/dist` com qualquer servidor de arquivos estáticos
(nginx, Vercel, etc.), apontando `/api` para o backend.

## API

```
GET    /api/reports
POST   /api/reports
GET    /api/reports/:id
PUT    /api/reports/:id
DELETE /api/reports/:id

POST   /api/reports/test          # testa uma query antes de salvar (sem :id)
POST   /api/reports/:id/test      # re-testa a query de um relatório salvo
POST   /api/reports/:id/execute
POST   /api/reports/execute-all

GET    /api/sync
PUT    /api/sync
POST   /api/sync/run-now

GET    /api/email-alert
PUT    /api/email-alert
POST   /api/email-alert/test
POST   /api/email-alert/send-now

GET    /api/dashboard
GET    /api/dashboard/suppliers
GET    /api/dashboard/suppliers/:supplier

POST   /api/comparisons
GET    /api/comparisons/:id
GET    /api/comparisons/reports/by-supplier/:fornecedor

GET    /api/executions
GET    /api/executions/:id

GET    /api/health
GET    /api/health/sankhya
```

Todas as entradas são validadas com **Zod** (`backend/src/middlewares/validate.ts`)
— o backend nunca confia diretamente em dados vindos do frontend.

## Integração Sankhya

Isolada em `backend/src/integrations/sankhya/`:

- **`SankhyaAuthService`** — autentica via `grant_type=client_credentials`,
  mantém o token em **cache em memória** com margem de segurança antes da
  expiração, e evita autenticações concorrentes duplicadas.
- **`SankhyaClient`** — camada HTTP: headers, `X-Token`, timeout, e retry único
  em caso de `401` (invalida o token, autentica de novo, repete a chamada uma vez).
- **`SankhyaDbExplorerService`** — executa `DbExplorerSP.executeQuery`.
- **`SankhyaAdapter`** — converte a resposta bruta em um formato colunar
  genérico (`{ columns, rows }`), isolando o "formato Sankhya" do resto do
  sistema (facilita adicionar outro ERP no futuro).

## Cadastro de relatórios

Tela **Relatórios → Cadastrar**:

1. Preencha nome, fornecedor, tipo e a query SQL.
2. Clique em **Testar Query** — o backend executa a query real no DbExplorer,
   identifica as colunas retornadas e valida contra o contrato obrigatório
  (`FORNECEDOR`, `OPERACAO`, `NF`, `VLR_LIQUIDO`, `QUANTIDADE`; `VLR_BRUTO` é opcional).
3. Se alguma coluna obrigatória faltar, o sistema informa exatamente qual
   (`REPORT_INVALID_SCHEMA`) e **não permite salvar**.
4. Se válida, uma prévia dos registros normalizados é exibida e o botão
   **Salvar relatório** é liberado.

## Como executar uma query

- **Testar** (`POST /api/reports/test` ou `/api/reports/:id/test`): executa a
  seco, sem persistir execução nem registros — usado só para validação/prévia.
- **Executar** (`POST /api/reports/:id/execute`): executa de verdade, grava
  uma `ReportExecution` e os `ReportRecord` normalizados resultantes.
- **Executar todos os ativos** (`POST /api/reports/execute-all`): roda
  sequencialmente todos os relatórios com `ativo: true`.

## Como realizar um cruzamento

Tela **Relatórios → Cruzar Relatórios**:

1. Selecione um fornecedor.
2. Selecione dois ou mais relatórios daquele fornecedor.
3. (Opcional) ajuste a tolerância monetária.
4. Clique em **Cruzar relatórios**.

O backend (`ComparisonService`) usa `FORNECEDOR + NF + OPERACAO` como chave e
compara `VLR_LIQUIDO`, `VLR_BRUTO` e `QUANTIDADE` entre todas as fontes
selecionadas (suporta 2 ou mais relatórios simultaneamente), classificando cada
nota como `OK`, `DIVERGENCIA` ou `AUSENTE`, com o(s) tipo(s) de divergência
específico(s) (`VALOR_LIQUIDO_DIVERGENTE`, `VALOR_BRUTO_DIVERGENTE`,
`QUANTIDADE_DIVERGENTE`, `NOTA_AUSENTE_RELATORIO_A/B`).

## Sincronização agendada

Em **Configurações**, é possível ativar a sincronização automática e
selecionar um intervalo entre 5 minutos e 24 horas ou o modo **Mensal**, com dia
do mês e horário específicos (por exemplo, dia 2 às 08:00). O backend executa,
de forma sequencial, as queries de todos os relatórios ativos, persiste uma nova execução
e seus registros normalizados; o Dashboard passa a usar esses registros na
próxima consulta.

Também é possível usar **Sincronizar agora** para executar o mesmo fluxo
imediatamente. Apenas uma sincronização pode ocorrer por vez. A configuração e
o histórico da última execução ficam em `backend/data/sync-schedule.json`.

### Alertas por e-mail

Em **Configurações → Alertas por e-mail**, informe o endereço que
enviará as mensagens, o endereço que receberá os alertas e a senha do remetente.
O envio ocorre depois de cada sincronização quando houver divergências ou notas
ausentes. A senha nunca é retornada para o frontend nem escrita em logs.

Configure o servidor SMTP no `backend/.env`:

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
```

Use **Testar SMTP** antes de ativar o alerta. O e-mail informa os fornecedores
afetados, notas divergentes, notas ausentes e a diferença de valor líquido no
momento da sincronização.

O envio imediato usa os últimos dados sincronizados e está disponível em
**Enviar alerta agora**. O resultado de cruzamentos manuais é persistido
(`comparisons.json`) e pode ser consultado depois via `GET /api/comparisons/:id`.

## Testes

```bash
cd backend
npm test
```

Cobre (via Vitest):

- **Normalização** — colunas obrigatórias ausentes, conversão de string
  numérica BR/US, `null`/vazio → zero, NF como string com zeros à esquerda.
- **Comparação** — NF igual, NF diferente, divergência de valor líquido e
  quantidade, nota ausente em cada lado, valor bruto opcional para exibição,
  tolerância monetária configurável,
  e cruzamento com 3+ relatórios simultâneos.

## Troubleshooting

| Sintoma | Causa provável |
|---|---|
| `Variável de ambiente obrigatória ausente: SANKHYA_API_URL` | `backend/.env` não foi criado a partir de `.env.example`. |
| `SANKHYA_AUTH_ERROR` | Credenciais inválidas ou endpoint/formato de autenticação incorreto — revisar `SankhyaAuthService.ts`. |
| `SANKHYA_INVALID_RESPONSE` | O formato de resposta do DbExplorer não bate com o esperado em `SankhyaAdapter.ts` — confirmar com a documentação oficial. |
| `REPORT_INVALID_SCHEMA` ao testar/salvar | A query não retorna todas as colunas obrigatórias (comparação é case/acento-insensitive). |
| `Cannot find module 'zod'` ao rodar `tsc` em `shared/` | Rode `npm install` **na raiz** do projeto (não dentro de `backend/`), para o workspace fazer o hoisting do `node_modules`. |
