const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Open-Meteo API 설정 (API 키 불필요!)
// 도시명 -> 좌표 변환을 위한 간단한 매핑
const cityCoords = {
  'seoul': { lat: 37.5665, lon: 126.9780, name: '서울' },
  'busan': { lat: 35.1796, lon: 129.0756, name: '부산' },
  'incheon': { lat: 37.4563, lon: 126.7052, name: '인천' },
  'daegu': { lat: 35.8714, lon: 128.6014, name: '대구' },
  'daejeon': { lat: 36.3504, lon: 127.3845, name: '대전' },
  'gwangju': { lat: 35.1595, lon: 126.8526, name: '광주' },
  'ulsan': { lat: 35.5384, lon: 129.3114, name: '울산' },
  'suwon': { lat: 37.2636, lon: 127.0286, name: '수원' },
  'jeju': { lat: 33.4996, lon: 126.5312, name: '제주' },
  'tokyo': { lat: 35.6762, lon: 139.6503, name: '도쿄' },
  'london': { lat: 51.5074, lon: -0.1278, name: '런던' },
  'paris': { lat: 48.8566, lon: 2.3522, name: '파리' },
  'new york': { lat: 40.7128, lon: -74.0060, name: '뉴욕' },
};

// 캐시 설정 (5분간 유효)
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5분

function getCachedData(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('캐시에서 데이터 반환:', key);
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}

// API 엔드포인트
app.get('/api/weather/:city', async (req, res) => {
  try {
    console.log('req.params.city: ', req.params.city);
    const city = req.params.city.toLowerCase();
    const cacheKey = `weather_${city}`;

    // 캐시 확인
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    // 도시 좌표 찾기
    const coords = cityCoords[city];
    if (!coords) {
      return res.status(404).json({ error: '지원하지 않는 도시입니다. (seoul, busan, tokyo, london 등 사용 가능)' });
    }

    // Open-Meteo API 호출 (API 키 불필요)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`;

    const response = await fetch(url);
    console.log('response status:', response.status);
    const data = await response.json();
    console.log('data: ', data);

    if (response.ok) {
      // OpenWeatherMap 형식으로 변환
      const weatherData = {
        cod: 200,
        name: coords.name,
        coord: { lat: coords.lat, lon: coords.lon },
        sys: {
          country: getCountryCode(city)
        },
        main: {
          temp: data.current.temperature_2m,
          feels_like: data.current.apparent_temperature,
          humidity: data.current.relative_humidity_2m,
          pressure: 1013, // Open-Meteo는 기압 정보가 없으므로 표준 기압값
        },
        weather: [{
          id: data.current.weather_code,
          main: getWeatherDescription(data.current.weather_code),
          description: getWeatherDescription(data.current.weather_code),
          icon: getWeatherIcon(data.current.weather_code),
        }],
        wind: {
          speed: data.current.wind_speed_10m,
          deg: data.current.wind_direction_10m,
        },
      };

      setCachedData(cacheKey, weatherData);
      res.json(weatherData);
    } else {
      res.status(500).json({ error: '날씨 데이터를 가져올 수 없습니다.' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// WMO Weather Code를 설명으로 변환하는 함수
function getWeatherDescription(code) {
  const weatherCodes = {
    0: '맑음',
    1: '대체로 맑음',
    2: '부분적으로 흐림',
    3: '흐림',
    45: '안개',
    48: '짙은 안개',
    51: '가벼운 이슬비',
    53: '이슬비',
    55: '강한 이슬비',
    61: '약한 비',
    63: '비',
    65: '강한 비',
    71: '약한 눈',
    73: '눈',
    75: '강한 눈',
    77: '진눈깨비',
    80: '약한 소나기',
    81: '소나기',
    82: '강한 소나기',
    85: '약한 눈 소나기',
    86: '눈 소나기',
    95: '천둥번개',
    96: '우박을 동반한 천둥번개',
    99: '강한 우박을 동반한 천둥번개',
  };
  return weatherCodes[code] || '알 수 없음';
}

// WMO Weather Code를 OpenWeatherMap 아이콘 코드로 변환
function getWeatherIcon(code) {
  const iconMap = {
    0: '01d',    // 맑음
    1: '02d',    // 대체로 맑음
    2: '03d',    // 부분적으로 흐림
    3: '04d',    // 흐림
    45: '50d',   // 안개
    48: '50d',   // 짙은 안개
    51: '09d',   // 가벼운 이슬비
    53: '09d',   // 이슬비
    55: '09d',   // 강한 이슬비
    61: '10d',   // 약한 비
    63: '10d',   // 비
    65: '10d',   // 강한 비
    71: '13d',   // 약한 눈
    73: '13d',   // 눈
    75: '13d',   // 강한 눈
    77: '13d',   // 진눈깨비
    80: '09d',   // 약한 소나기
    81: '09d',   // 소나기
    82: '09d',   // 강한 소나기
    85: '13d',   // 약한 눈 소나기
    86: '13d',   // 눈 소나기
    95: '11d',   // 천둥번개
    96: '11d',   // 우박을 동반한 천둥번개
    99: '11d',   // 강한 우박을 동반한 천둥번개
  };
  return iconMap[code] || '01d';
}

// 도시명으로 국가 코드 반환
function getCountryCode(city) {
  const countryMap = {
    'seoul': 'KR',
    'busan': 'KR',
    'incheon': 'KR',
    'daegu': 'KR',
    'daejeon': 'KR',
    'gwangju': 'KR',
    'ulsan': 'KR',
    'suwon': 'KR',
    'jeju': 'KR',
    'tokyo': 'JP',
    'london': 'GB',
    'paris': 'FR',
    'new york': 'US',
  };
  return countryMap[city] || '';
}

// 5일 예보 API
app.get('/api/forecast/:city', async (req, res) => {
  try {
    const city = req.params.city.toLowerCase();
    const cacheKey = `forecast_${city}`;

    // 캐시 확인
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    // 도시 좌표 찾기
    const coords = cityCoords[city];
    if (!coords) {
      return res.status(404).json({ error: '지원하지 않는 도시입니다.' });
    }

    // Open-Meteo API 호출 (7일 예보)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=7`;

    const response = await fetch(url);
    const data = await response.json();

    if (response.ok) {
      // OpenWeatherMap 형식으로 변환
      const forecastData = {
        cod: '200',
        city: {
          name: coords.name,
          coord: { lat: coords.lat, lon: coords.lon },
        },
        list: data.daily.time.map((time, index) => ({
          dt: new Date(time).getTime() / 1000,
          dt_txt: time,
          main: {
            temp: (data.daily.temperature_2m_max[index] + data.daily.temperature_2m_min[index]) / 2,
            temp_max: data.daily.temperature_2m_max[index],
            temp_min: data.daily.temperature_2m_min[index],
          },
          weather: [{
            id: data.daily.weather_code[index],
            main: getWeatherDescription(data.daily.weather_code[index]),
            description: getWeatherDescription(data.daily.weather_code[index]),
            icon: getWeatherIcon(data.daily.weather_code[index]),
          }],
          wind: {
            speed: data.daily.wind_speed_10m_max[index],
          },
          pop: data.daily.precipitation_sum[index] > 0 ? 1 : 0,
        }))
      };

      setCachedData(cacheKey, forecastData);
      res.json(forecastData);
    } else {
      res.status(500).json({ error: '예보 데이터를 가져올 수 없습니다.' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// React 빌드 파일 제공
app.use(express.static(path.join(__dirname, 'client/build')));

// 모든 라우트를 React 앱으로 전달 (API 라우트 제외)
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});

