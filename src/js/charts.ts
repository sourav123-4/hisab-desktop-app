import Chart from 'chart.js/auto';

let expenseChartInstance: any = null;
let cashFlowChartInstance: any = null;
let momChartInstance: any = null;

function getThemeColors() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    textColor: isLight ? '#475569' : '#94a3b8',
    borderColor: isLight ? '#ffffff' : '#111827',
    gridColor: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.06)'
  };
}

export function renderExpenseCategoryChart(canvasId: string, categoryData: Record<string, number>) {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
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
    if (existingChart.options.plugins?.legend?.labels) {
      existingChart.options.plugins.legend.labels.color = textColor;
    }
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
        borderWidth: 3,
        borderColor: borderColor,
        hoverOffset: 6
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
            padding: 14,
            boxWidth: 12,
            font: { family: 'Inter', size: 11.5, weight: 600 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#f8fafc',
          bodyColor: '#38bdf8',
          padding: 10,
          cornerRadius: 8,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          callbacks: {
            label: function(context: any) {
              const label = context.label || '';
              const value = context.parsed || 0;
              return `${label}: ₹${value.toLocaleString('en-IN')}`;
            }
          }
        }
      },
      cutout: '68%'
    }
  });
}

export function renderCashFlowBarChart(canvasId: string, metrics: any) {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const { textColor, gridColor } = getThemeColors();
  const newData = [
    metrics.totalIncome || 0,
    metrics.totalExpenses || 0,
    metrics.totalInvestments || 0,
    metrics.totalEmisPaid || 0
  ];

  let gradIncome = '#10b981';
  let gradExpense = '#ef4444';
  let gradInvest = '#6366f1';
  let gradEmi = '#f59e0b';

  if (ctx) {
    const g1 = ctx.createLinearGradient(0, 0, 0, 200);
    g1.addColorStop(0, '#10b981'); g1.addColorStop(1, '#047857');
    gradIncome = g1 as any;

    const g2 = ctx.createLinearGradient(0, 0, 0, 200);
    g2.addColorStop(0, '#ef4444'); g2.addColorStop(1, '#b91c1c');
    gradExpense = g2 as any;

    const g3 = ctx.createLinearGradient(0, 0, 0, 200);
    g3.addColorStop(0, '#6366f1'); g3.addColorStop(1, '#4338ca');
    gradInvest = g3 as any;

    const g4 = ctx.createLinearGradient(0, 0, 0, 200);
    g4.addColorStop(0, '#f59e0b'); g4.addColorStop(1, '#b45309');
    gradEmi = g4 as any;
  }

  const existingChart = Chart.getChart(canvas) || cashFlowChartInstance;
  if (existingChart && existingChart.ctx && existingChart.canvas === canvas) {
    existingChart.data.datasets[0].data = newData;
    if (existingChart.options.scales?.x?.ticks) existingChart.options.scales.x.ticks.color = textColor;
    if (existingChart.options.scales?.y?.ticks) existingChart.options.scales.y.ticks.color = textColor;
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
        backgroundColor: [gradIncome, gradExpense, gradInvest, gradEmi],
        borderRadius: 10,
        borderSkipped: false
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (context: any) => `₹${context.parsed.y.toLocaleString('en-IN')}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { family: 'Inter', weight: 600 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'Inter' },
            callback: (value: any) => '₹' + value.toLocaleString('en-IN')
          }
        }
      }
    }
  });
}

export function renderMomTrendChart(canvasId: string, storeInstance: any) {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas || !storeInstance) return;

  const ctx = canvas.getContext('2d');
  const { textColor, gridColor } = getThemeColors();
  const knownMonths = storeInstance.getKnownMonthYears();

  // Always build at least 6 consecutive months leading up to current month
  const monthsSet = new Set<string>(knownMonths);
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    monthsSet.add(`${y}-${m}`);
  }

  const monthsToDisplay = Array.from(monthsSet).sort().slice(-6);

  const incomeData: number[] = [];
  const expenseData: number[] = [];

  monthsToDisplay.forEach((m: string) => {
    const metrics = storeInstance.getMonthlyMetrics(m);
    incomeData.push(metrics.totalIncome || 0);
    expenseData.push(metrics.netOutflow || 0);
  });

  let fillIncome: any = 'rgba(16, 185, 129, 0.15)';
  let fillExpense: any = 'rgba(239, 68, 68, 0.15)';

  if (ctx) {
    const gInc = ctx.createLinearGradient(0, 0, 0, 220);
    gInc.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    gInc.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
    fillIncome = gInc;

    const gExp = ctx.createLinearGradient(0, 0, 0, 220);
    gExp.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
    gExp.addColorStop(1, 'rgba(239, 68, 68, 0.02)');
    fillExpense = gExp;
  }

  const existingChart = Chart.getChart(canvas) || momChartInstance;
  if (existingChart && existingChart.ctx && existingChart.canvas === canvas) {
    existingChart.data.labels = monthsToDisplay;
    existingChart.data.datasets[0].data = incomeData;
    existingChart.data.datasets[1].data = expenseData;
    existingChart.update('none');
    momChartInstance = existingChart;
    return;
  }

  if (existingChart) {
    try { existingChart.destroy(); } catch (e) {}
  }

  momChartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels: monthsToDisplay,
      datasets: [
        {
          label: 'Total Income',
          data: incomeData,
          borderColor: '#10b981',
          backgroundColor: fillIncome,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7
        },
        {
          label: 'Total Outflow',
          data: expenseData,
          borderColor: '#ef4444',
          backgroundColor: fillExpense,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 5,
          pointHoverRadius: 7
        }
      ]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: textColor,
            font: { family: 'Inter', size: 12, weight: 600 },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: 12,
          cornerRadius: 8,
          titleColor: '#f8fafc',
          bodyColor: '#38bdf8',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          callbacks: {
            label: (context: any) => `${context.dataset.label}: ₹${context.parsed.y.toLocaleString('en-IN')}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { family: 'Inter', weight: 600 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'Inter' },
            callback: (v: any) => '₹' + Number(v).toLocaleString('en-IN')
          }
        }
      }
    }
  });
}
