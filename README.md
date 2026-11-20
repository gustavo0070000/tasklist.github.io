# tasklist — Gustavo & Isabella

Lista de tarefas do casal em tempo real (PWA + Firebase Realtime Database), com quadro por pessoa, calendário, metas, mural de recados, lista de desejos, conquistas e modo foco.

## Integrações
- **Modo Painel** (`painel.html`): tela de parede para a Echo Show 15 / TV, aberta pela skill da Alexa.
- **Google Agenda** do Gustavo e da Isabella no Resumo, no Calendário e no painel; tarefas com prazo viram eventos.
- **Push** com o app fechado, lembretes de prazo e **resumo matinal** (push, Telegram e a Echo falando).
- **Bot do Telegram**, **skill da Alexa "nossa lista"**, **clima** (Open-Meteo) e **Compartilhar → tasklist** no Android.

Passo a passo de configuração: **[INTEGRACOES.md](INTEGRACOES.md)**.

## Estrutura
```
index.html, css/style.css, js/app.js   app principal
painel.html, css/painel.css, js/painel.js   Modo Painel (Echo Show 15)
js/agenda.js     agenda unificada (Google Agenda + tarefas)
js/weather.js    clima (Open-Meteo)
js/push.js       registro de push (FCM)
integrations/google-apps-script/   backend gratuito (agendas, push, Telegram, resumo)
integrations/alexa-skill/          skill da Alexa (Alexa-hosted, Node.js)
```
