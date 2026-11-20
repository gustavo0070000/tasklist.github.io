// Preencha com os dados do seu Firebase (os mesmos do app).
module.exports = {
  FIREBASE_URL: 'https://SEU-PROJETO-default-rtdb.firebaseio.com',
  SECRET_KEY: 'sua-chave-secreta',

  // Cole aqui o link de "Configurações → Modo Painel → Copiar link p/ Alexa"
  // (ele já leva a conexão do banco). A skill acrescenta &alexa=1 sozinha.
  PANEL_URL: 'https://gustavo0070000.github.io/tasklist.github.io/painel.html?config=COLE_AQUI',

  // Fuso do Brasil (sem horário de verão desde 2019)
  UTC_OFFSET: '-03:00',
  // Hora do prazo quando você diz "hoje" ou "amanhã"
  DEFAULT_DEADLINE_HOUR: 21
};
