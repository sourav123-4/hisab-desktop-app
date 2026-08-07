import Chart from 'chart.js/auto';

let expenseChartInstance = null;
let cashFlowChartInstance = null;

function getThemeColors() {
  const isLight = document.body.getAttribute('data-theme') === 'light';
  return {
    textColor: isLight ? '#475569' : '#94a3b8',
    borderColor: isLight ? '#ffffff' : '#111827',
    gridColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.06)'
  };
}

export function renderExpenseCategoryChart(canvasId, categoryData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const { textColor, borderColor } = getThemeColors();
  const labels = Object.keys(categoryData);
  const values = Object.values(categoryData);

  if (labels.length === 0) {
    labels.push('No Expenses');
    values.push(1);
  }

  const colors = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', 
    '#06b6d4', '#8b5cf6', '#ec4899', '#64748b'
  ];

  const existingChart = Chart.getChart(canvas) || expenseChartInstance;
  if (existingChart && existingChart.ctx && existingChart.canvas === canvas) {
    existingChart.data.labels = labels;
    existingChart.data.datasets[0].data = values;
    existingChart.data.datasets[0].backgroundColor = colors.slice(0, labels.length);
    existingChart.data.datasets[0].borderColor = borderColor;
    existingChart.options.plugins.legend.labels.color = textColor;
    existingChart.update('none');
    expenseChartInstance = existingChart;
    return;
  }

  if (existingChart) {
    try { existingChart.destroy(); } catch (e) {}
  }

  expenseChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: borderColor
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: textColor,
            padding: 12,
            boxWidth: 12,
            font: { family: 'Inter', size: 11.5 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const label = context.label || '';
              const value = context.parsed || 0;
              return `${label}: ₹${value.toLocaleString('en-IN')}`;
            }
          }
        }
      },
      cutout: '70%'
    }
  });
}

export function renderCashFlowBarChart(canvasId, metrics) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const { textColor, gridColor } = getThemeColors();
  const newData = [
    metrics.totalIncome || 0,
    metrics.totalExpenses || 0,
    metrics.totalInvestments || 0,
    metrics.totalEmisPaid || 0
  ];

  const existingChart = Chart.getChart(canvas) || cashFlowChartInstance;
  if (existingChart && existingChart.ctx && existingChart.canvas === canvas) {
    existingChart.data.datasets[0].data = newData;
    if (existingChart.options.scales.x) existingChart.options.scales.x.ticks.color = textColor;
    if (existingChart.options.scales.y) existingChart.options.scales.y.ticks.color = textColor;
    existingChart.update('none');
    cashFlowChartInstance = existingChart;
    return;
  }

  if (existingChart) {
    try { existingChart.destroy(); } catch (e) {}
  }

  cashFlowChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['Income', 'Daily Expenses', 'Investments', 'EMIs Paid'],
      datasets: [{
        label: 'Amount (₹)',
        data: newData,
        backgroundColor: [
          '#10b981',
          '#ef4444',
          '#6366f1',
          '#f59e0b'
        ],
        borderRadius: 8
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `₹${context.parsed.y.toLocaleString('en-IN')}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { family: 'Inter' } }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'Inter' },
            callback: (value) => '₹' + value.toLocaleString('en-IN')
          }
        }
      }
    }
  });
}
