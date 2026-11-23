// Clima via Open-Meteo (gratuito, sem chave, com CORS liberado).
// A cidade fica salva nas configurações compartilhadas (settings/{chave}/weather).

const CACHE_KEY = 'tasklist_weather_cache_v1';
const CACHE_MS = 20 * 60 * 1000;

const WMO = {
  0: ['☀️', 'Céu limpo'], 1: ['🌤️', 'Poucas nuvens'], 2: ['⛅', 'Parcialmente nublado'], 3: ['☁️', 'Nublado'],
  45: ['🌫️', 'Neblina'], 48: ['🌫️', 'Neblina'],
  51: ['🌦️', 'Garoa fraca'], 53: ['🌦️', 'Garoa'], 55: ['🌦️', 'Garoa forte'], 56: ['🌦️', 'Garoa gelada'], 57: ['🌦️', 'Garoa gelada'],
  61: ['🌧️', 'Chuva fraca'], 63: ['🌧️', 'Chuva'], 65: ['🌧️', 'Chuva forte'], 66: ['🌧️', 'Chuva gelada'], 67: ['🌧️', 'Chuva gelada'],
  71: ['🌨️', 'Neve fraca'], 73: ['🌨️', 'Neve'], 75: ['🌨️', 'Neve forte'], 77: ['🌨️', 'Granizo fino'],
  80: ['🌦️', 'Pancadas fracas'], 81: ['🌧️', 'Pancadas de chuva'], 82: ['⛈️', 'Pancadas fortes'],
  85: ['🌨️', 'Neve'], 86: ['🌨️', 'Neve forte'],
  95: ['⛈️', 'Trovoadas'], 96: ['⛈️', 'Trovoadas com granizo'], 99: ['⛈️', 'Trovoadas com granizo']
};

export function describeWeather(code, isDay = 1) {
  const [icon, label] = WMO[code] || ['🌡️', 'Tempo'];
  if (!isDay && (code === 0 || code === 1)) return { icon: '🌙', label };
  return { icon, label };
}

function readCache(loc) {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && c.lat === loc.lat && c.lon === loc.lon && Date.now() - c.at < CACHE_MS) return c.data;
  } catch (e) { /* sem localStorage (ex.: Alexa) */ }
  return null;
}

function writeCache(loc, data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ lat: loc.lat, lon: loc.lon, at: Date.now(), data })); } catch (e) { /* ignore */ }
}

export async function fetchWeather(loc, { force = false } = {}) {
  if (!loc || typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return null;
  if (!force) {
    const cached = readCache(loc);
    if (cached) return cached;
  }
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${loc.lat}&longitude=${loc.lon}`
    + '&current=temperature_2m,apparent_temperature,weather_code,is_day'
    + '&hourly=temperature_2m,precipitation_probability,weather_code'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
    + '&timezone=auto&forecast_days=4';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Open-Meteo HTTP ' + res.status);
  const raw = await res.json();
  const data = summarizeWeather(raw, loc.name);
  writeCache(loc, data);
  return data;
}

function summarizeWeather(raw, name) {
  const cur = raw.current || {};
  const now = new Date();
  const hours = (raw.hourly && raw.hourly.time ? raw.hourly.time : []).map((t, i) => ({
    time: new Date(t),
    temp: raw.hourly.temperature_2m[i],
    rain: raw.hourly.precipitation_probability ? raw.hourly.precipitation_probability[i] : 0,
    code: raw.hourly.weather_code[i]
  })).filter(h => h.time >= new Date(now.getTime() - 60 * 60 * 1000));

  const next12 = hours.slice(0, 13);
  const rainy = next12.find(h => (h.rain || 0) >= 50);
  const maxRain = next12.reduce((m, h) => Math.max(m, h.rain || 0), 0);

  const days = (raw.daily && raw.daily.time ? raw.daily.time : []).map((t, i) => {
    const [y, m, d] = t.split('-').map(Number);
    return {
      date: new Date(y, m - 1, d),
      code: raw.daily.weather_code[i],
      max: Math.round(raw.daily.temperature_2m_max[i]),
      min: Math.round(raw.daily.temperature_2m_min[i]),
      rain: raw.daily.precipitation_probability_max ? raw.daily.precipitation_probability_max[i] : 0
    };
  });

  return {
    name: name || '',
    temp: Math.round(cur.temperature_2m),
    feels: Math.round(cur.apparent_temperature),
    code: cur.weather_code,
    isDay: cur.is_day,
    ...describeWeather(cur.weather_code, cur.is_day),
    rainAlert: rainy
      ? `Chance de chuva às ${rainy.time.getHours()}h (${rainy.rain}%) ☔`
      : (maxRain >= 30 ? `Possibilidade de chuva (${maxRain}%)` : ''),
    hours: next12.filter((_, i) => i % 3 === 0).slice(0, 5),
    days
  };
}

async function queryGeocoding(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=6&language=pt&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding HTTP ' + res.status);
  const json = await res.json();
  return (json.results || []).map(r => ({
    name: r.name,
    admin1: r.admin1 || '',
    countryCode: r.country_code || '',
    label: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '),
    lat: Math.round(r.latitude * 1000) / 1000,
    lon: Math.round(r.longitude * 1000) / 1000
  }));
}

export async function searchCity(query) {
  const clean = String(query || '').trim();
  if (clean.length < 2) return [];
  let results = await queryGeocoding(clean);
  if (results.length === 0 && /[,-/]/.test(clean)) {
    const parts = clean.split(/[,-/]/).map(p => p.trim()).filter(Boolean);
    if (parts[0] && parts[0].length >= 2) {
      results = await queryGeocoding(parts[0]);
      const hint = (parts[1] || '').toLowerCase();
      if (hint && results.length > 1) {
        results.sort((a, b) => {
          const aMatch = (a.admin1 + ' ' + a.countryCode).toLowerCase().includes(hint) ? 0 : 1;
          const bMatch = (b.admin1 + ' ' + b.countryCode).toLowerCase().includes(hint) ? 0 : 1;
          return aMatch - bMatch;
        });
      }
    }
  }
  return results.map(({ name, label, lat, lon }) => ({ name, label, lat, lon }));
}
