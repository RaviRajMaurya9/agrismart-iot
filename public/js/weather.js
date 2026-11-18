/**
 * 10-Day Agricultural Weather Forecast Module
 * Fetches Open-Meteo meteorological data with evapotranspiration,
 * renders Chart.js temperature/rain trends, and generates day-by-day farmer advisories.
 */

window.WeatherModule = (function () {
  let weatherChartInstance = null;
  let cachedDays = [];

  function init() {
    const refreshBtn = document.getElementById('refreshWeatherBtn');
    const locationInput = document.getElementById('weatherLocationInput');

    refreshBtn?.addEventListener('click', () => {
      const loc = locationInput?.value.trim() || 'Central Agro Station';
      loadForecast(loc);
    });

    locationInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const loc = locationInput?.value.trim() || 'Central Agro Station';
        loadForecast(loc);
      }
    });
  }

  async function loadForecast(location = 'Central Agro Station') {
    try {
      const res = await fetch(`/api/weather/forecast?location=${encodeURIComponent(location)}`);
      const json = await res.json();

      if (json.success && json.daily) {
        cachedDays = json.daily;
        renderTodayCard(cachedDays[0]);
        renderWeatherGrid(cachedDays);
        renderWeatherChart(cachedDays);
      }
    } catch (err) {
      console.warn('Weather forecast fetch failed:', err);
    }
  }

  function renderTodayCard(today) {
    if (!today) return;

    const icon = document.getElementById('todayWeatherIcon');
    const maxT = document.getElementById('todayTempMax');
    const minT = document.getElementById('todayTempMin');
    const cond = document.getElementById('todayCondition');
    const rain = document.getElementById('todayRainProb');
    const wind = document.getElementById('todayWind');
    const hum = document.getElementById('todayHumidity');
    const uv = document.getElementById('todayUV');
    const adv = document.getElementById('todayAgriAdvisory');

    if (icon) icon.textContent = today.icon;
    if (maxT) maxT.textContent = today.tempMax;
    if (minT) minT.textContent = `${today.tempMin}°C`;
    if (cond) cond.textContent = today.condition;
    if (rain) rain.textContent = `${today.precipitationProb}% (${today.precipitationMm} mm)`;
    if (wind) wind.textContent = `${today.windSpeedKm} km/h`;
    if (hum) hum.textContent = `${today.humidity}%`;
    if (uv) uv.textContent = `${today.uvIndex} (Max)`;
    if (adv) adv.textContent = today.agriAdvisory;
  }

  function renderWeatherGrid(days) {
    const grid = document.getElementById('weather10DayGrid');
    if (!grid || !days) return;

    grid.innerHTML = days.map((day, idx) => {
      const isToday = idx === 0;
      const border = isToday ? 'border-brand-500/60 bg-slate-900/90 shadow-brand-500/10' : 'border-slate-800 bg-slate-900/60';
      
      // Rain indicator color
      const rainColor = day.precipitationProb > 50 ? 'text-blue-400 font-bold' : 'text-slate-400';

      return `
        <div class="rounded-2xl p-4 border ${border} shadow-lg flex flex-col justify-between hover:border-slate-700 transition">
          <div>
            <div class="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2.5">
              <div>
                <div class="font-extrabold text-sm text-white">${day.dayName}</div>
                <div class="text-[10px] text-slate-400 font-mono">${day.date}</div>
              </div>
              <span class="text-3xl">${day.icon}</span>
            </div>

            <div class="text-xs font-semibold text-slate-300 mb-2 truncate">${day.condition}</div>

            <div class="flex items-baseline space-x-2 mb-3">
              <span class="text-2xl font-black text-white font-mono">${day.tempMax}°</span>
              <span class="text-xs font-bold text-slate-400 font-mono">/ ${day.tempMin}°C</span>
            </div>

            <div class="space-y-1.5 text-[11px] font-mono text-slate-300">
              <div class="flex items-center justify-between">
                <span class="text-slate-400">Rain Prob:</span>
                <span class="${rainColor}"><i class="fa-solid fa-droplet text-[9px] mr-0.5"></i>${day.precipitationProb}%</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-400">Precipitation:</span>
                <span>${day.precipitationMm} mm</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-400">Humidity:</span>
                <span>${day.humidity}%</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-slate-400">Wind:</span>
                <span>${day.windSpeedKm} km/h</span>
              </div>
              <div class="flex items-center justify-between pt-1 border-t border-slate-800">
                <span class="text-slate-400">ET0 (Evapo):</span>
                <span class="text-emerald-400">${day.evapotranspiration} mm/d</span>
              </div>
            </div>
          </div>

          <!-- Farm Advisory Pill -->
          <div class="mt-3 pt-2.5 border-t border-slate-800">
            <div class="text-[10px] text-amber-300/90 leading-tight">
              <i class="fa-solid fa-wheat-awn mr-1"></i>${day.agriAdvisory}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderWeatherChart(days) {
    const ctx = document.getElementById('weatherTrendChart');
    if (!ctx || !days) return;

    const labels = days.map(d => d.dayName);
    const maxTemps = days.map(d => d.tempMax);
    const minTemps = days.map(d => d.tempMin);
    const rainProbs = days.map(d => d.precipitationProb);

    if (weatherChartInstance) {
      weatherChartInstance.destroy();
    }

    weatherChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: 'Max Temp (°C)',
            data: maxTemps,
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            borderWidth: 2.5,
            tension: 0.3,
            pointRadius: 4,
            yAxisID: 'yTemp'
          },
          {
            type: 'line',
            label: 'Min Temp (°C)',
            data: minTemps,
            borderColor: '#38bdf8',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.3,
            pointRadius: 3,
            yAxisID: 'yTemp'
          },
          {
            type: 'bar',
            label: 'Rain Probability (%)',
            data: rainProbs,
            backgroundColor: 'rgba(59, 130, 246, 0.35)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 6,
            yAxisID: 'yRain'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: '#94a3b8',
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          },
          tooltip: {
            backgroundColor: '#090d16',
            borderColor: '#334155',
            borderWidth: 1,
            titleFont: { family: 'Plus Jakarta Sans', size: 12 },
            bodyFont: { family: 'JetBrains Mono', size: 11 },
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(51, 65, 85, 0.25)' },
            ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } }
          },
          yTemp: {
            type: 'linear',
            position: 'left',
            min: 10,
            max: 45,
            grid: { color: 'rgba(51, 65, 85, 0.25)' },
            ticks: {
              color: '#f97316',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (v) => `${v}°C`
            }
          },
          yRain: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 100,
            grid: { drawOnChartArea: false },
            ticks: {
              color: '#60a5fa',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (v) => `${v}%`
            }
          }
        }
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    loadForecast
  };
})();
