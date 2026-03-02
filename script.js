document.addEventListener('DOMContentLoaded', () => {
    let allTransactions = [];
    let currentChart = null;
    let currentView = 'monthly';

    // DOM Elements
    const viewButtons = document.querySelectorAll('.view-btn');
    const filterGroups = document.querySelectorAll('.filter-group');

    // Inputs
    const daySelect = document.getElementById('day-select');
    const weekSelect = document.getElementById('week-select');
    const monthSelect = document.getElementById('month-select');
    const yearSelect = document.getElementById('year-select');

    // Metrics
    const metricTotal = document.getElementById('metric-total');
    const metricHigh = document.getElementById('metric-high');
    const metricLow = document.getElementById('metric-low');
    const metricAvg = document.getElementById('metric-avg');
    const currentViewSpan = document.getElementById('current-view');

    // Chart.js Theme
    Chart.defaults.color = '#8b949e';
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.scale.grid.color = 'rgba(48, 54, 61, 0.5)';

    // Load Data
    fetch('transactions.json')
        .then(response => response.json())
        .then(data => {
            allTransactions = data.map(t => ({
                amount: parseFloat(t.amount),
                date: new Date(t.timestamp)
            }));

            initFilters();
            // Start with Monthly view for the latest month
            updateDashboard('monthly');
        })
        .catch(error => {
            console.error('Error loading data:', error);
            alert('Failed to load transactions.json. Make sure you run analyze.py and serve the site.');
        });

    // Helper: Format Date as YYYY-MM-DD
    function toISODate(d) {
        return d.toISOString().split('T')[0];
    }

    // Helper: Get ISO Week string "YYYY-Www"
    function getISOWeekString(d) {
        const date = new Date(d.getTime());
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
        const week1 = new Date(date.getFullYear(), 0, 4);
        const weekNumber = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
        return `${date.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
    }

    function initFilters() {
        if (allTransactions.length === 0) return;

        // Find min and max dates
        const dates = allTransactions.map(t => t.date.getTime());
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));

        // 1. Day Picker setup
        daySelect.min = toISODate(minDate);
        daySelect.max = toISODate(maxDate);
        daySelect.value = toISODate(maxDate); // Default to last available day

        // 2. Week Select setup (Unique Weeks)
        const uniqueWeeks = new Set();
        allTransactions.forEach(t => uniqueWeeks.add(getISOWeekString(t.date)));
        Array.from(uniqueWeeks).sort().reverse().forEach(wk => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = wk;
            weekSelect.appendChild(opt);
        });

        // 3. Month Select setup (Unique Months "YYYY-MM")
        const uniqueMonths = new Set();
        allTransactions.forEach(t => {
            const m = `${t.date.getFullYear()}-${(t.date.getMonth() + 1).toString().padStart(2, '0')}`;
            uniqueMonths.add(m);
        });
        Array.from(uniqueMonths).sort().reverse().forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            // Format better for display e.g. "2025-02" -> "Feb 2025"
            const dateObj = new Date(m + "-01");
            opt.textContent = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
            monthSelect.appendChild(opt);
        });

        // 4. Year Select setup
        const uniqueYears = new Set();
        allTransactions.forEach(t => uniqueYears.add(t.date.getFullYear()));
        Array.from(uniqueYears).sort().reverse().forEach(y => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = y;
            yearSelect.appendChild(opt);
        });

        // Event Listeners for Filters
        daySelect.addEventListener('change', () => updateDashboard('daily'));
        weekSelect.addEventListener('change', () => updateDashboard('weekly'));
        monthSelect.addEventListener('change', () => updateDashboard('monthly'));
        yearSelect.addEventListener('change', () => updateDashboard('yearly'));
    }

    // Event Listeners for View Buttons
    viewButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            viewButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            const view = e.target.dataset.view;
            currentView = view;

            // Hide all filters
            filterGroups.forEach(g => g.classList.add('hidden'));
            // Show specific filter
            document.getElementById(`filter-${view}`).classList.remove('hidden');

            updateDashboard(view);
        });
    });

    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    }

    function updateDashboard(view) {
        let filteredTx = [];
        let groupBy = '';
        let viewLabel = '';

        if (view === 'daily') {
            const selectedDay = daySelect.value;
            filteredTx = allTransactions.filter(t => toISODate(t.date) === selectedDay);
            groupBy = 'hour'; // group line chart points by hour
            viewLabel = `Daily (${selectedDay})`;
        }
        else if (view === 'weekly') {
            const selectedWeek = weekSelect.value;
            filteredTx = allTransactions.filter(t => getISOWeekString(t.date) === selectedWeek);
            groupBy = 'day'; // group by day of week
            viewLabel = `Weekly (${selectedWeek})`;
        }
        else if (view === 'monthly') {
            const selectedMonth = monthSelect.value; // YYYY-MM
            filteredTx = allTransactions.filter(t => {
                const m = `${t.date.getFullYear()}-${(t.date.getMonth() + 1).toString().padStart(2, '0')}`;
                return m === selectedMonth;
            });
            groupBy = 'day'; // group by day of month
            const dObj = new Date(selectedMonth + "-01");
            viewLabel = `Monthly (${dObj.toLocaleString('default', { month: 'short', year: 'numeric' })})`;
        }
        else if (view === 'yearly') {
            const selectedYear = parseInt(yearSelect.value);
            filteredTx = allTransactions.filter(t => t.date.getFullYear() === selectedYear);
            groupBy = 'month'; // group by month
            viewLabel = `Yearly (${selectedYear})`;
        }

        currentViewSpan.textContent = viewLabel;

        if (filteredTx.length === 0) {
            animateValue(metricTotal, 0);
            metricHigh.textContent = '₹0';
            metricLow.textContent = '₹0';
            metricAvg.textContent = '₹0';
            renderChart([], [], view);
            return;
        }

        // Metrics logic (Raw transaction values!)
        const total = filteredTx.reduce((sum, t) => sum + t.amount, 0);
        const amounts = filteredTx.map(t => t.amount);
        const maxHigh = Math.max(...amounts);
        const minLow = Math.min(...amounts);
        const overallAvg = total / filteredTx.length;

        animateValue(metricTotal, total);
        metricHigh.textContent = formatCurrency(maxHigh);
        metricLow.textContent = formatCurrency(minLow);
        metricAvg.textContent = formatCurrency(overallAvg);

        // Grouping Data for Line Chart
        const chartData = groupData(filteredTx, groupBy);
        renderChart(chartData.labels, chartData.data, view);
    }

    function groupData(transactions, groupBy) {
        const groups = {};

        transactions.forEach(t => {
            let key = '';
            // Determine grouping key
            switch (groupBy) {
                case 'hour':
                    // format HH:00
                    const hh = t.date.getHours().toString().padStart(2, '0');
                    key = `${hh}:00`;
                    break;
                case 'day':
                    // format YYYY-MM-DD
                    key = toISODate(t.date);
                    break;
                case 'month':
                    // format YYYY-MM
                    key = `${t.date.getFullYear()}-${(t.date.getMonth() + 1).toString().padStart(2, '0')}`;
                    break;
            }
            if (!groups[key]) groups[key] = 0;
            groups[key] += t.amount;
        });

        // Sort keys chronologically
        const labels = Object.keys(groups).sort();
        const data = labels.map(l => groups[l]);

        // Format labels for display
        const friendlyLabels = labels.map(l => {
            if (groupBy === 'day') {
                const parts = l.split('-');
                return `${parts[2]}/${parts[1]}`; // DD/MM
            }
            if (groupBy === 'month') {
                const parts = l.split('-');
                const d = new Date(l + "-01");
                return d.toLocaleString('default', { month: 'short' }); // Jan, Feb
            }
            return l; // Keep hour as HH:00
        });

        return { labels: friendlyLabels, data: data };
    }

    function animateValue(obj, end) {
        let startTimestamp = null;
        const duration = 800;
        const start = 0;

        // Clear old raw html manually to avoid jumping
        obj.innerHTML = '₹0';

        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(easeOut * (end - start) + start);

            obj.innerHTML = formatCurrency(current);

            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    function renderChart(labels, data, view) {
        const ctx = document.getElementById('transactionChart').getContext('2d');

        // Gradient fill for area under line chart
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(88, 166, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(88, 166, 255, 0.01)');

        if (currentChart) {
            // Update existing chart smoothly
            currentChart.data.labels = labels;
            currentChart.data.datasets[0].data = data;
            currentChart.update();
        } else {
            // Create new chart
            currentChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Spent (₹)',
                        data: data,
                        fill: true,
                        backgroundColor: gradient,
                        borderColor: '#58a6ff',
                        borderWidth: 3,
                        pointBackgroundColor: '#0d1117',
                        pointBorderColor: '#58a6ff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        pointHoverBackgroundColor: '#a371f7',
                        pointHoverBorderColor: '#fff',
                        tension: 0.4 // Makes the line smooth/curvy!
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 800,
                        easing: 'easeOutQuart'
                    },
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(22, 27, 34, 0.95)',
                            titleColor: '#e6edf3',
                            bodyColor: '#e6edf3',
                            borderColor: '#30363d',
                            borderWidth: 1,
                            padding: 12,
                            callbacks: {
                                label: function (context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += formatCurrency(context.parsed.y);
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(48, 54, 61, 0.5)'
                            },
                            ticks: {
                                callback: function (value) {
                                    if (value >= 1000) {
                                        return '₹' + (value / 1000).toFixed(1) + 'k';
                                    }
                                    return '₹' + value;
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }
    }
});
