/**
 * 1) Preencha Config.gs   2) Rode instalarGatilhos() uma vez (autorize)
 * 3) Rode testarTudo() e confira o "Registro de execução".
 */
function instalarGatilhos() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('sincronizarTudo').timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger('aCadaMinuto').timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger('resumoMatinal').timeBased().atHour(cfg('MORNING_HOUR')).nearMinute(0).everyDays(1)
    .inTimezone(cfg('TIMEZONE')).create();

  sincronizarTudo();
  Logger.log('✅ Gatilhos instalados: agendas a cada 15 min, avisos a cada 1 min, resumo às ' + cfg('MORNING_HOUR') + 'h.');
}

function sincronizarTudo() {
  try { sincronizarAgendas(); } catch (e) { Logger.log('Agendas: ' + e.message); }
  try { sincronizarTarefasNaAgenda(); } catch (e) { Logger.log('Tarefas → agenda: ' + e.message); }
}

function testarTudo() {
  Logger.log('1) Firebase: ' + (loadData_().tasks ? 'OK, tarefas encontradas' : 'conectado, mas sem tarefas'));
  Logger.log('2) Agendas: ' + JSON.stringify(sincronizarAgendas()));
  Logger.log('3) Clima: ' + JSON.stringify(climaDeHoje_()));
  var r = montarResumo_();
  Logger.log('4) Resumo:\n' + r.html);
  Logger.log('5) Push Gus: ' + enviarPush('Gus', 'Teste do tasklist', 'Se chegou, o push está funcionando! 📲') + ' aparelho(s)');
  if (cfg('TELEGRAM_BOT_TOKEN')) Logger.log('6) Telegram: ' + JSON.stringify(enviarTelegram(telegramDoUsuario_('Gus'), '🤖 Teste do tasklist: Telegram OK!')));
  if (cfg('VOICE_MONKEY_TOKEN')) Logger.log('7) Echo: ' + anunciarNaEcho('Teste do tasklist. Se você me ouviu, está tudo certo!'));
}

function pararTudo() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  Logger.log('Gatilhos removidos.');
}
