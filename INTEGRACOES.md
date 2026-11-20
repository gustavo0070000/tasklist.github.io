# Integrações — Echo Show, Google Agenda, Push, Telegram e mais

Guia para ligar as integrações do **tasklist do Gustavo & Isabella**. Faça na ordem: cada etapa usa a anterior.

```
 Google Agenda (Gus + Isa) ─┐
                            ├─▶ Google Apps Script ─▶ Firebase ─▶ app no celular + painel na Echo Show 15
 Telegram  ◀────────────────┤    (roda sozinho na                       ▲
 Push (FCM) ◀───────────────┤     nuvem do Google)                      │
 Echo falando (Voice Monkey)◀┘                                          │
                                                                        │
 "Alexa, pede pra nossa lista…" ─▶ Skill da Alexa ─────────────────────┘
```

| O quê | Onde fica | Custo |
|---|---|---|
| Modo Painel (tela da Echo / TV) | `painel.html` | grátis |
| Google Agenda dos dois no app | `integrations/google-apps-script` | grátis |
| Tarefas com prazo viram eventos na agenda | Apps Script | grátis |
| Push com o app fechado + lembrete de prazo | Apps Script + Firebase Cloud Messaging | grátis |
| Resumo matinal (Telegram, push, Echo falando) | Apps Script | grátis |
| Bot do Telegram | Apps Script | grátis |
| Echo anunciando carinhos e o resumo | Voice Monkey | grátis até 200 anúncios/mês |
| Skill "nossa lista" na Alexa | `integrations/alexa-skill` | grátis (Alexa-hosted) |
| Clima no Resumo e no Painel | Open-Meteo | grátis, sem cadastro |
| "Compartilhar → tasklist" vira desejo/tarefa | `manifest.json` (share target) | grátis (Android) |

---

## 1. Atualize as regras do Firebase (obrigatório)

As integrações usam três nós novos, **separados** do nó principal, para que o app nunca os apague ao salvar:

- `calendar/{chave}` — eventos do Google Agenda (só o Apps Script escreve)
- `settings/{chave}` — clima e configuração do push, compartilhados pelos dois
- `push/{chave}` — tokens de notificação de cada aparelho

No [console do Firebase](https://console.firebase.google.com) → **Realtime Database → Regras**, cole:

```json
{
  "rules": {
    "tasks":    { "$secret_key": { ".read": "true",  ".write": "true"  } },
    "settings": { "$secret_key": { ".read": "true",  ".write": "true"  } },
    "push":     { "$secret_key": { ".read": "false", ".write": "true"  } },
    "calendar": { "$secret_key": { ".read": "true",  ".write": "false" } }
  }
}
```

> 🔒 **Sobre segurança:** as regras protegem pela **chave secreta**, e quem souber a chave lê tudo, inclusive a agenda. Se a chave de vocês for curta ou fácil (tipo `gus-isa-familia`), troque por uma longa e aleatória. Para isso, exporte o backup (Configurações → Exportar JSON), conecte com a chave nova e importe o backup.

---

## 2. Google Apps Script (agendas, push, Telegram, resumo)

Rode na conta Google do **Gustavo**, a mesma que é dona do projeto Firebase. O script usa o login dessa conta para gravar no Firebase e enviar push, sem precisar de senha.

### 2.1 A Isa compartilha a agenda com o Gustavo
No Google Agenda da Isa (pelo computador): **Configurações → (agenda dela) → Compartilhar com pessoas específicas → e-mail do Gustavo → "Ver todos os detalhes dos eventos"**. O Gustavo aceita o convite que chega por e-mail.

> Quer esconder um compromisso do app/painel? Escreva `#privado` na descrição do evento: ele aparece só como "Ocupado".

### 2.2 Crie o projeto
1. Abra [script.google.com](https://script.google.com) → **Novo projeto** → dê o nome "tasklist".
2. ⚙️ **Configurações do projeto** → marque **"Mostrar o arquivo de manifesto appsscript.json"**.
3. Volte em **Editor** e crie um arquivo para cada `.gs` desta pasta, com o mesmo nome e o mesmo conteúdo: `Config`, `Firebase`, `CalendarSync`, `Messaging`, `Notifier`, `MorningSummary`, `Weather`, `Telegram`, `Setup`. Substitua também o `appsscript.json`.
4. Preencha o **`Config.gs`**:
   - `FIREBASE_URL`, `FIREBASE_PROJECT_ID`, `SECRET_KEY`: os mesmos do app (Configurações → Banco de Dados).
   - `CALENDARS.Isa`: o e-mail da Isa.
   - `ISA_EMAIL_TO_SHARE_TASKS_CALENDAR`: o e-mail da Isa, para ela também ver a agenda "Tarefas do Casal ✅".
   - Telegram e Voice Monkey podem ficar vazios por enquanto (seções 5 e 6).

### 2.3 Ligue
1. No topo do editor, escolha a função **`instalarGatilhos`** → **Executar**.
2. O Google vai pedir autorização. Como o script é seu, aparece "O Google não verificou este app": clique em **Avançado → Acessar tasklist (não seguro)** → **Permitir**.
3. Rode **`testarTudo`** e confira em **Registro de execução** se cada etapa deu OK.

Pronto. A partir daí, sem nenhum aparelho ligado:
- **a cada 15 min** as agendas dos dois são sincronizadas, e as tarefas com prazo viram eventos na agenda "Tarefas do Casal ✅", com lembrete 30 min antes;
- **a cada 1 min** quem fez algo gera aviso para o outro (push e/ou Telegram), carinhos são falados pela Echo, lembretes de prazo saem e o bot do Telegram responde;
- **todo dia às 7h** sai o resumo matinal (agenda + tarefas + clima).

No app aparece a **Agenda de Hoje** no Resumo, os compromissos no **Calendário** (cor de cada um, "Ambos" quando o evento está na agenda dos dois) e o status em **Configurações → Google Agenda**.

> Limites da conta gratuita do Google: o gatilho de 1 minuto usa cerca de 30–50 min de execução por dia, abaixo do limite de 90 min. Se aparecer erro de cota, troque `everyMinutes(1)` por `everyMinutes(5)` em `Setup.gs` e rode `instalarGatilhos` de novo.

---

## 3. Clima
No app: **Configurações → Clima → buscar a cidade → tocar no resultado.** Vale para os dois aparelhos e para o painel. Aparece um aviso de chuva quando a chance passa de 50% nas próximas 12 h.

---

## 4. Push (avisos com o app fechado)

1. Console do Firebase → ⚙️ **Configurações do projeto → Geral → Seus apps**. Se não houver um app da Web, clique em **</>** e registre um (não precisa de Hosting). Copie `messagingSenderId` e `appId`.
2. Mesma tela → aba **Cloud Messaging → Certificados push da Web → Gerar par de chaves**. Copie a chave (VAPID).
3. Confirme que a **API Firebase Cloud Messaging (V1)** aparece como ativada nessa aba.
4. No app: **Configurações → Push → "Configuração do Firebase Cloud Messaging"** → cole os 3 valores → **Salvar para os dois aparelhos**.
5. Em **cada celular**: **Ativar Push neste aparelho**.
   - iPhone: só funciona com o app **instalado na Tela de Início** (Compartilhar → Adicionar à Tela de Início), no iOS 16.4 ou mais novo. Abra pelo ícone e ative ali.
6. No Apps Script, rode `testarTudo` de novo: o passo 5 manda um push de teste para o Gustavo.

O que chega por push: o que o outro fez (tarefas, recados, desejos, metas), carinhos, lembrete 30 min antes do prazo e resumo matinal.

---

## 5. Bot do Telegram (opcional)

1. No Telegram, fale com **@BotFather** → `/newbot` → escolha nome e usuário → copie o **token**.
2. Cole o token em `TELEGRAM_BOT_TOKEN` (no `Config.gs` ou em **Propriedades do script**).
3. Cada um manda **`/id`** para o bot. Ele responde o seu número. Coloque os dois em `TELEGRAM_USERS: { Gus: '…', Isa: '…' }`.
4. Opcional: crie um grupo com vocês dois e o bot, mande `/id` no grupo e use o ID do grupo em `TELEGRAM_GROUP_CHAT_ID` para o resumo matinal ir para lá.

| Comando | O que faz |
|---|---|
| `/hoje` | agenda + tarefas de hoje + clima |
| `/tarefas` | pendentes numeradas por pessoa |
| `/add lavar o carro pra isa amanhã` | nova tarefa (entende "pro gus", "pra isa", "pros dois", "hoje", "amanhã") |
| texto solto | vira tarefa para quem mandou |
| `/feito 3` ou `/feito louça` | conclui |
| `/mercado leite e pão` | adiciona na lista "Mercado" |
| `/recado …` | fixa um recado no mural |
| `/carinho 🥰 Saudade!` | manda um carinho (e a Echo fala!) |
| `/resumo` | resumo matinal na hora |

---

## 6. Echo falando em voz alta — Voice Monkey (opcional)

1. Crie uma conta em [voicemonkey.io](https://voicemonkey.io) e, no app da Alexa, ative a skill **Voice Monkey** (vincule a conta).
2. No painel do Voice Monkey, crie um **Speaker** apontando para a Echo Show 15 e copie o **ID** dele.
3. Em **Tokens**, gere um token.
4. No `Config.gs`: `VOICE_MONKEY_TOKEN` e `VOICE_MONKEY_DEVICE`. A voz padrão é `Camila` (pt-BR). Se não soar em português, teste `Vitoria` ou `Ricardo`.
5. `ANNOUNCE_NUDGES` (carinhos) e `ANNOUNCE_MORNING` (resumo das 7h) ligam/desligam. Entre 22h e 7h ela fica quieta (`ANNOUNCE_QUIET_HOURS`).

> O plano grátis tem **200 anúncios por mês**. Por isso só carinhos e o resumo matinal falam em voz alta. As outras atividades vão por push/Telegram.

---

## 7. Modo Painel na Echo Show 15

O painel (`painel.html`) foi feito para **1920×1080 na horizontal** e nunca rola: agenda de hoje + próximos dias, uma coluna para cada um (Gustavo, Isabella, Ambos) com toque para concluir, recado do mural, clima, meta mais próxima e progresso do dia. À noite (22h30–6h) ele escurece sozinho, e um toque acorda por 2 min. Ele também se desloca 1–3 px de tempos em tempos para não marcar a tela e recarrega de madrugada para pegar versões novas.

Tarefa de **Ambos** pergunta "Quem concluiu?" (Gustavo / Isabella / Os dois). Tarefas de cada um concluem direto em nome da pessoa.

### 7.1 Pegue o link do painel
No app (celular): **Configurações → Modo Painel → Copiar link p/ Alexa**. O link já leva a conexão do banco, então a Echo não precisa fazer login.

### 7.2 Teste rápido no navegador da Echo
"Alexa, abre o Silk" → digite o link. Funciona, mas a Echo volta para a tela inicial depois de um tempo. Para deixar de verdade na tela, use a skill.

### 7.3 Skill "nossa lista" (recomendado)
1. Entre no [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) com **a mesma conta Amazon da Echo** → **Create Skill**:
   - Nome: `Nossa Lista` · Idioma: **Portuguese (BR)** · Tipo: **Custom** · Hospedagem: **Alexa-hosted (Node.js)** · Template: *Start from scratch*.
2. **Build → Interaction Model → JSON Editor** → cole `integrations/alexa-skill/skill-package/interactionModels/custom/pt-BR.json` → **Save** → **Build Model**.
3. **Build → Interfaces** → ative **Alexa Web API for Games** → **Save Interfaces** → **Build Model** de novo.
4. **Code** → substitua o `index.js` e o `package.json` pelos desta pasta (`integrations/alexa-skill/lambda`) e crie `config.js` e `firebase.js`. No `config.js`, preencha `FIREBASE_URL`, `SECRET_KEY` e `PANEL_URL` (o link do passo 7.1) → **Deploy**.
5. **Test** → mude para **Development**.
6. Na Echo: **"Alexa, abre nossa lista"**.

> ℹ️ A Amazon só **publica** skills da Web API que sejam jogos. Por isso esta skill fica **em desenvolvimento**, funcionando só nos aparelhos da sua conta, que é exatamente o que vocês precisam. Não envie para certificação.

**Deixar o painel sempre aberto:** no app da Alexa → **Rotinas → +**. Faça uma rotina "Quando: Horário, todos os dias 6:00" com a ação **Personalizado: "abre nossa lista"**, escolhendo a Echo Show 15 como dispositivo. Crie outras nos horários em que vocês mais usam (ex.: 12h e 18h). Se alguém usar timer, música etc., o painel fecha. É só falar "Alexa, abre nossa lista".

**Comandos de voz** (com o painel aberto, dá pra falar só "Alexa, …" + o comando):

| Fale | O que acontece |
|---|---|
| "Alexa, pede pra nossa lista **adicionar** lavar a louça pro Gustavo" | tarefa do Gustavo |
| "… **adicionar** ligar pro pediatra pra Isa amanhã" | tarefa da Isa com prazo amanhã 21h |
| "… **comprar** leite e café" | vai para a lista Mercado |
| "Alexa, pergunta pra nossa lista **o que tem pra hoje**" | lê agenda + tarefas do dia |
| "… **marcar como feita** lavar a louça" | conclui |
| "… **deixar um recado** comprei pão" | recado no mural |
| "… **mandar um beijo pra Isa**" | carinho (aparece no app dela e no painel) |

> A Amazon desligou em 2024 o acesso de apps às listas nativas da Alexa. Por isso "Alexa, adiciona leite na lista de compras" vai para a lista da Alexa, não para o tasklist. Use "pede pra **nossa lista**…".

---

## 8. Compartilhar do celular → tasklist (Android)

Com o app **instalado** (Chrome → "Instalar app"), o tasklist aparece no menu **Compartilhar** do Android:
- **link** (ex.: produto de uma loja) → abre "Novo Desejo" já preenchido;
- **texto** → abre "Nova Tarefa Rápida" já preenchida.

O iPhone ainda não permite que web apps apareçam no menu Compartilhar.

---

## Solução de problemas

| Sintoma | O que verificar |
|---|---|
| "Aguardando o sincronizador" no app | Rode `testarTudo` no Apps Script e leia o registro. `Sem acesso à agenda de Isabella` = falta aceitar o compartilhamento (2.1). |
| `Firebase … 401/403` no Apps Script | A conta Google que roda o script precisa ser **proprietária/editora** do projeto Firebase. |
| Erro ao salvar cidade/push no app | As regras da seção 1 não foram publicadas. |
| Push não chega | Rode `testarTudo` e veja a linha "Push falhou". Se aparecer `PERMISSION_DENIED`/`SERVICE_DISABLED`, ative a **Firebase Cloud Messaging API** no Google Cloud do projeto. No iPhone, o app precisa estar na Tela de Início. |
| Painel mostra "não está conectado" | Use o link **Copiar link p/ Alexa**, não o endereço puro do `painel.html`. |
| "Alexa, abre nossa lista" só fala, não mostra | A interface **Alexa Web API for Games** não foi ativada (7.3 passo 3) ou o modelo não foi recompilado. |
| Echo não fala os carinhos | Confira o token/ID do Voice Monkey, o horário de silêncio e a cota de 200/mês. |
