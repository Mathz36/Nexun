# Nexun

O Nexun consulta relatórios no ERP, organiza os dados por fornecedor e ajuda a
encontrar diferenças entre fontes. Hoje ele usa o `DbExplorerSP.executeQuery`,
mas o restante da aplicação trabalha com um formato próprio e não depende dos
detalhes da resposta do ERP.

## Por que este projeto existe

No início de cada mês, a equipe precisa validar as vendas de cada laboratório
antes de enviar o fechamento mensal. Para isso, os valores enviados diariamente
são comparados com outros relatórios internos. Antes do Nexun, esse trabalho
envolvia exportar os arquivos, cruzar os dados manualmente e procurar as
divergências linha a linha.

O Nexun automatiza esse processo: executa as consultas, cruza os relatórios,
identifica as notas com diferença ou ausência e envia um alerta por e-mail. Com
isso, o colaborador consegue ir direto ao problema, corrigir o que for
necessário e encaminhar o fechamento com mais segurança.

Na prática, a automação economiza cerca de quatro horas em um dia de trabalho
de nove horas. O tempo que antes era gasto preparando e conferindo arquivos
fica disponível para tratar as exceções e concluir o fechamento.

## Sumário

- [Por que este projeto existe](#por-que-este-projeto-existe)
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
- [Problemas comuns](#problemas-comuns)

## O que ele faz

- Cadastra e testa queries SQL.
- Executa relatórios manualmente ou em lote.
- Normaliza os dados retornados pelo ERP.
- Mostra totais por fornecedor e operação.
- Compara dois ou mais relatórios nota a nota.
- Aponta notas ausentes e diferenças de valor líquido ou quantidade.
- Sincroniza os relatórios em um intervalo ou em uma data mensal.
- Envia alertas por e-mail quando encontra problemas.

Para salvar uma query, ela precisa retornar `FORNECEDOR`, `OPERACAO`, `NF`,
`VLR_LIQUIDO` e `QUANTIDADE`. `VLR_BRUTO` é opcional e serve apenas para
exibição; a comparação de valores usa sempre o líquido.

## Stack

**Backend:** Node.js, Express, TypeScript, Zod, Axios.
**Frontend:** Astro, TypeScript, Tailwind CSS (build estático, sem framework de UI).
**Armazenamento:** arquivos JSON, sem banco relacional. Cada gravação é feita
em um arquivo temporário e depois renomeada, para evitar arquivos incompletos.

## Estrutura

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

O fluxo principal é simples:

```
Controller → Service → Repository (JSON)
Service → Sankhya Integration → API Sankhya
```

O frontend chama apenas a API do backend. As credenciais e a comunicação com o
ERP ficam no servidor.

## Pré-requisitos

- Node.js 20+
- npm 10+

## Instalação

O projeto usa npm workspaces. Instale as dependências na raiz para que backend,
frontend e `shared/` usem a mesma instalação.

```powershell
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

PORT=3036
DATA_DIR=./data
```

> **`SANKHYA_X_TOKEN`, `CLIENT_ID` e `CLIENT_SECRET` nunca são expostos ao
> frontend.** Eles só existem no processo do backend (`process.env`), nunca em
> uma resposta HTTP, log, ou arquivo versionado. `.env` está no `.gitignore`.

### Sobre a integração com o ERP

Os detalhes do payload e da autenticação estão isolados nestes arquivos. Eles
devem ser conferidos com a documentação e com uma chamada real antes de usar a
integração em produção:

- `backend/src/integrations/sankhya/SankhyaAuthService.ts`
- `backend/src/integrations/sankhya/SankhyaClient.ts`
- `backend/src/integrations/sankhya/SankhyaDbExplorerService.ts`
- `backend/src/integrations/sankhya/sankhya.types.ts`

## Armazenamento de dados

Os dados ficam em arquivos JSON dentro de `backend/data/` (ou no diretório
definido por `DATA_DIR`):

| Arquivo             | Conteúdo                                   |
|----------------------|---------------------------------------------|
| `reports.json`       | Relatórios cadastrados                     |
| `executions.json`    | Histórico de execuções                     |
| `records.json`       | Registros normalizados de cada execução    |
| `comparisons.json`   | Resultados de cruzamentos persistidos       |

As escritas substituem o arquivo inteiro e usam um arquivo temporário antes da
renomeação. Essa lógica fica em `backend/src/repositories/JsonRepository.ts`.

## Execução em desenvolvimento

Na raiz do projeto, abra dois terminais:

```bash
# terminal 1 — backend (exemplo: porta 3036)
npm run dev:backend

# terminal 2 — frontend (exemplo: porta 3037)
$env:BACKEND_URL = "http://localhost:3036"
npm run dev:frontend -- --port 3037
```

O dev server do Astro faz proxy de `/api/*` para `http://localhost:3036`
(configurável via `BACKEND_URL`).

## Produção

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

As entradas da API são validadas com Zod em `backend/src/middlewares/validate.ts`.

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

Na tela **Relatórios → Cadastrar**:

1. Preencha nome, fornecedor, tipo e query SQL.
2. Clique em **Testar Query** para executar a query e validar as colunas.
3. Corrija o que for apontado pelo sistema, se necessário.
4. Salve o relatório depois que o teste passar.

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

O cruzamento usa `FORNECEDOR + NF + OPERACAO` como chave. O valor líquido e a
quantidade são comparados entre as fontes; o bruto, quando existir, é mostrado
apenas como informação. Cada nota recebe um status: `OK`, `DIVERGENCIA` ou
`AUSENTE`.

## Sincronização agendada

Em **Configurações**, ative a sincronização e escolha um intervalo ou o modo
**Mensal**, com dia e horário definidos. O backend executa as queries dos
relatórios ativos em sequência e salva os novos registros. O Dashboard usa os
dados da última execução.

**Sincronizar agora** executa o mesmo fluxo imediatamente. Apenas uma execução
pode ocorrer por vez. A configuração fica em `backend/data/sync-schedule.json`.

### Alertas por e-mail

Em **Configurações → Alertas por e-mail**, informe o remetente, o destinatário e
a senha do remetente. O alerta é enviado depois da sincronização quando houver
divergências ou notas ausentes. A senha não aparece no frontend nem nos logs.

Configure o servidor SMTP no `backend/.env`:

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
```

Use **Testar SMTP** antes de ativar o alerta. A mensagem enviada traz os
fornecedores afetados, as notas divergentes, as notas ausentes e a diferença de
valor líquido encontrada na execução.

O envio imediato usa os últimos dados sincronizados e está disponível em
**Enviar alerta agora**. O resultado de cruzamentos manuais é persistido
(`comparisons.json`) e pode ser consultado depois via `GET /api/comparisons/:id`.

## Testes

```bash
cd backend
npm test
```

Cobre, via Vitest:

- **Normalização** — colunas obrigatórias ausentes, conversão de string
  numérica BR/US, `null`/vazio → zero, NF como string com zeros à esquerda.
- **Comparação** — NF igual, NF diferente, divergência de valor líquido e
  quantidade, nota ausente em cada lado, valor bruto opcional para exibição,
  tolerância monetária configurável,
  e cruzamento com 3+ relatórios simultâneos.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| `Variável de ambiente obrigatória ausente: SANKHYA_API_URL` | `backend/.env` não foi criado a partir de `.env.example`. |
| `SANKHYA_AUTH_ERROR` | Confira as credenciais e a URL de autenticação. |
| `SANKHYA_INVALID_RESPONSE` | Confira o formato retornado pelo DbExplorer e o adapter. |
| `REPORT_INVALID_SCHEMA` ao testar/salvar | A query não retorna `FORNECEDOR`, `OPERACAO`, `NF`, `VLR_LIQUIDO` ou `QUANTIDADE`. |
| `Cannot find module 'zod'` ao rodar `tsc` em `shared/` | Rode `npm install` **na raiz** do projeto (não dentro de `backend/`), para o workspace fazer o hoisting do `node_modules`. |
