// Tab functionality
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;

        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}Tab`).classList.add('active');

        // Load data for the active tab
        if (tabName === 'venues') loadVenues();
        if (tabName === 'sources') loadSources();
        if (tabName === 'logs') loadLogs();
    });
});

// Load venues
async function loadVenues() {
    try {
        const response = await fetch('/admin/venues');
        const venues = await response.json();

        const tbody = document.querySelector('#venuesTable tbody');

        if (venues.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading">No venues found</td></tr>';
            return;
        }

        tbody.innerHTML = venues.map(venue => `
            <tr>
                <td><strong>${escapeHtml(venue.name)}</strong></td>
                <td>${escapeHtml(venue.city)}</td>
                <td>${escapeHtml(venue.country)}</td>
                <td>${venue.exhibition_count || 0}</td>
                <td>${venue.last_scraped ? formatDateTime(venue.last_scraped) : 'Never'}</td>
                <td>
                    <a href="${escapeHtml(venue.website_url)}" target="_blank" style="margin-right: 10px;">Visit</a>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load venues:', error);
    }
}

// Load scraping sources
async function loadSources() {
    try {
        const response = await fetch('/admin/sources');
        const sources = await response.json();

        const tbody = document.querySelector('#sourcesTable tbody');

        if (sources.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="loading">No sources found</td></tr>';
            return;
        }

        tbody.innerHTML = sources.map(source => `
            <tr>
                <td><strong>${escapeHtml(source.venue_name)}</strong><br><small>${escapeHtml(source.city)}</small></td>
                <td><a href="${escapeHtml(source.source_url)}" target="_blank" style="word-break: break-all;">${truncate(source.source_url, 50)}</a></td>
                <td><span class="status-badge status-active">${escapeHtml(source.source_type)}</span></td>
                <td>
                    ${source.last_status === 'success'
                        ? '<span class="status-badge status-success">Success</span>'
                        : source.last_status === 'failed'
                        ? '<span class="status-badge status-failed">Failed</span>'
                        : '<span class="status-badge status-inactive">Not Run</span>'
                    }
                </td>
                <td>${source.last_scraped_at ? formatDateTime(source.last_scraped_at) : 'Never'}</td>
                <td>
                    <button class="btn-success" onclick="indexSource(${source.id})">Index</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load sources:', error);
    }
}

// Load scraping logs
async function loadLogs() {
    try {
        const response = await fetch('/admin/logs');
        const logs = await response.json();

        const tbody = document.querySelector('#logsTable tbody');

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading">No logs found</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(log => `
            <tr>
                <td>${formatDateTime(log.scraped_at)}</td>
                <td><strong>${escapeHtml(log.venue_name)}</strong></td>
                <td>
                    ${log.status === 'success'
                        ? '<span class="status-badge status-success">Success</span>'
                        : '<span class="status-badge status-failed">Failed</span>'
                    }
                </td>
                <td>${log.exhibitions_found}</td>
                <td>${log.error_message ? `<span style="color: red;">${escapeHtml(log.error_message)}</span>` : '-'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load logs:', error);
    }
}

// Index all sources
document.getElementById('btnIndexAll').addEventListener('click', async () => {
    if (!confirm('This will scrape all active sources. This may take several minutes. Continue?')) {
        return;
    }

    try {
        const btn = document.getElementById('btnIndexAll');
        btn.disabled = true;
        btn.textContent = 'Indexing...';

        const response = await fetch('/admin/index/all', { method: 'POST' });
        const result = await response.json();

        alert(result.message);

        // Reload sources and logs after a delay
        setTimeout(() => {
            loadSources();
            loadLogs();
            btn.disabled = false;
            btn.textContent = '🔄 Index All Sources';
        }, 3000);
    } catch (error) {
        console.error('Failed to start indexing:', error);
        alert('Failed to start indexing');
    }
});

// Index a single source
async function indexSource(sourceId) {
    if (!confirm('Scrape this source now?')) {
        return;
    }

    try {
        const response = await fetch(`/admin/index/${sourceId}`, { method: 'POST' });
        const result = await response.json();

        alert(`${result.message}\nExhibitions found: ${result.exhibitions_found}`);

        loadSources();
        loadLogs();
    } catch (error) {
        console.error('Failed to index source:', error);
        alert('Failed to index source: ' + error.message);
    }
}

// Add venue modal
const addVenueModal = document.getElementById('addVenueModal');
const btnAddVenue = document.getElementById('btnAddVenue');
const btnCancelVenue = document.getElementById('btnCancelVenue');
const addVenueForm = document.getElementById('addVenueForm');

btnAddVenue.addEventListener('click', () => {
    addVenueModal.classList.add('show');
});

btnCancelVenue.addEventListener('click', () => {
    addVenueModal.classList.remove('show');
    addVenueForm.reset();
});

addVenueForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(addVenueForm);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch('/admin/venues', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Failed to add venue');
        }

        alert('Venue added successfully!');
        addVenueModal.classList.remove('show');
        addVenueForm.reset();
        loadVenues();
        loadSources();
    } catch (error) {
        console.error('Failed to add venue:', error);
        alert('Failed to add venue: ' + error.message);
    }
});

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function truncate(str, length) {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '...' : str;
}

// Make globally accessible
window.indexSource = indexSource;

// Load initial data
loadVenues();
