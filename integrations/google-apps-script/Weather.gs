/** Clima de hoje (Open-Meteo) usando a cidade salva no app: settings/{chave}/weather */
var WMO_PT = {
  0: 'céu limpo', 1: 'poucas nuvens', 2: 'parcialmente nublado', 3: 'nublado', 45: 'neblina', 48: 'neblina',
  51: 'garoa fraca', 53: 'garoa', 55: 'garoa forte', 61: 'chuva fraca', 63: 'chuva', 65: 'chuva forte',
  80: 'pancadas de chuva', 81: 'pancadas de chuva', 82: 'pancadas fortes', 95: 'trovoadas', 96: 'trovoadas', 99: 'trovoadas'
};

function climaDeHoje_() {
  try {
    var loc = fbGet('settings/' + secret_() + '/weather');
    if (!loc || typeof loc.lat !== 'number') return null;
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=1';
    var json = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
    var d = json.daily;
    var desc = WMO_PT[d.weather_code[0]] || 'tempo variável';
    var max = Math.round(d.temperature_2m_max[0]);
    var min = Math.round(d.temperature_2m_min[0]);
    var chuva = d.precipitation_probability_max ? d.precipitation_probability_max[0] : 0;
    var guardaChuva = chuva >= 50 ? ' Levem guarda-chuva! ☔' : '';
    return {
      texto: '🌦️ ' + loc.name + ': ' + desc + ', ' + min + '° a ' + max + '° · chuva ' + chuva + '%' + guardaChuva,
      curto: desc + ', máx ' + max + '°.' + guardaChuva,
      falado: 'Em ' + loc.name + ', ' + desc + ', máxima de ' + max + ' graus.' + (chuva >= 50 ? ' Levem guarda-chuva.' : '')
    };
  } catch (e) {
    Logger.log('Clima: ' + e.message);
    return null;
  }
}
