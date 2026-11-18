/**
 * Sensor Chart Module
 * Renders real-time line charts for DHT11 & Capacitive Soil Moisture
 * Enhanced with glowing gradients and glassmorphism styling.
 */

window.SensorChartModule = (function () {
  let chartInstance = null;

  function initChart() {
    const ctx = document.getElementById('sensorHistoryChart');
    if (!ctx) return;

    // Create subtle gradient fills
    const canvasContext = ctx.getContext('2d');
    
    const gradTemp = canvasContext.createLinearGradient(0, 0, 0, 260);
    gradTemp.addColorStop(0, 'rgba(245, 158, 11, 0.22)');
    gradTemp.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

    const gradHum = canvasContext.createLinearGradient(0, 0, 0, 260);
    gradHum.addColorStop(0, 'rgba(59, 130, 246, 0.18)');
    gradHum.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    const gradSoil = canvasContext.createLinearGradient(0, 0, 0, 260);
    gradSoil.addColorStop(0, 'rgba(34, 197, 94, 0.24)');
    gradSoil.addColorStop(1, 'rgba(34, 197, 94, 0.0)');

    const chartConfig = {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Temperature (°C)',
            borderColor: '#f59e0b',
            backgroundColor: gradTemp,
            data: [],
            borderWidth: 2.5,
            fill: true,
            tension: 0.38,
            pointRadius: 3,
            pointHoverRadius: 6,
            pointBackgroundColor: '#f59e0b',
            pointBorderColor: '#0f172a',
            pointBorderWidth: 1.5,
            yAxisID: 'yTemp'
          },
          {
            label: 'Humidity (%)',
            borderColor: '#38bdf8',
            backgroundColor: gradHum,
            data: [],
            borderWidth: 2,
            fill: true,
            tension: 0.38,
            pointRadius: 2.5,
            pointHoverRadius: 5,
            pointBackgroundColor: '#38bdf8',
            pointBorderColor: '#0f172a',
            pointBorderWidth: 1.5,
            yAxisID: 'yPct'
          },
          {
            label: 'Soil Moisture (%)',
            borderColor: '#22c55e',
            backgroundColor: gradSoil,
            data: [],
            borderWidth: 3,
            fill: true,
            tension: 0.38,
            pointRadius: 3.5,
            pointHoverRadius: 7,
            pointBackgroundColor: '#4ade80',
            pointBorderColor: '#064e3b',
            pointBorderWidth: 2,
            yAxisID: 'yPct'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: { top: 10, bottom: 5, left: 0, right: 0 }
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(6, 17, 11, 0.92)',
            borderColor: 'rgba(74, 222, 128, 0.3)',
            borderWidth: 1,
            titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: '700' },
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: function (context) {
                const label = context.dataset.label || '';
                const val = context.parsed.y;
                return `  ${label}: ${val}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(51, 65, 85, 0.18)'
            },
            ticks: {
              color: '#94a3b8',
              font: { family: 'JetBrains Mono', size: 10 },
              maxTicksLimit: 8
            }
          },
          yTemp: {
            type: 'linear',
            position: 'left',
            min: 10,
            max: 50,
            grid: {
              color: 'rgba(51, 65, 85, 0.18)'
            },
            ticks: {
              color: '#f59e0b',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (val) => `${val}°C`
            }
          },
          yPct: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 100,
            grid: {
              drawOnChartArea: false
            },
            ticks: {
              color: '#38bdf8',
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (val) => `${val}%`
            }
          }
        }
      }
    };

    chartInstance = new Chart(ctx, chartConfig);
  }

  function updateData(history) {
    if (!chartInstance) {
      initChart();
    }
    if (!chartInstance || !history || history.length === 0) return;

    const labels = history.map(item => item.timestamp);
    const temps = history.map(item => item.temperature);
    const humidities = history.map(item => item.humidity);
    const soils = history.map(item => item.soilMoisture);

    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = temps;
    chartInstance.data.datasets[1].data = humidities;
    chartInstance.data.datasets[2].data = soils;

    chartInstance.update('none');
  }

  document.addEventListener('DOMContentLoaded', initChart);

  return {
    updateData
  };
})();
