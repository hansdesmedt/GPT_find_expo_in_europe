// Map and markers
let map;
let markers = [];
let selectedCities = [];
let currentExhibitions = [];
let allCities = [];
let autocomplete;
let selectedPlace = null;
let visibleExhibitions = [];
let collapsedCountries = new Set();
let selectedVenue = null;

// Cookie utilities
function setCookie(name, value, days = 365) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${JSON.stringify(value)};expires=${expires.toUTCString()};path=/`;
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) {
            try {
                return JSON.parse(c.substring(nameEQ.length, c.length));
            } catch {
                return null;
            }
        }
    }
    return null;
}

// Save state to cookies
function saveState() {
    setCookie('selectedCities', selectedCities);
    setCookie('collapsedCountries', Array.from(collapsedCountries));
}

// Load state from cookies
function loadState() {
    const savedCities = getCookie('selectedCities');
    const savedCollapsed = getCookie('collapsedCountries');

    if (savedCities && Array.isArray(savedCities)) {
        selectedCities = savedCities;
    }

    if (savedCollapsed && Array.isArray(savedCollapsed)) {
        collapsedCountries = new Set(savedCollapsed);
    }
}

// Initialize the map
function initMap() {
    // Load saved state from cookies
    loadState();

    const defaultCenter = { lat: 50.8503, lng: 4.3517 };

    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 6,
        center: defaultCenter,
        styles: [
            {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
            }
        ],
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
        zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM
        }
    });

    // Set up event listeners
    setupEventListeners();

    // Initialize Google Places Autocomplete for city input
    initializeCityAutocomplete();

    // Add map bounds change listener to filter visible exhibitions
    map.addListener('bounds_changed', () => {
        updateVisibleExhibitions();
    });

    // Load initial data - cities first, then exhibitions
    loadCities().then(() => {
        loadExhibitions();
    });
}

// Load cities from database
async function loadCities() {
    try {
        const [citiesResponse, statusResponse] = await Promise.all([
            fetch('/api/cities'),
            fetch('/api/cities/status')
        ]);

        const cities = await citiesResponse.json();
        const cityStatus = await statusResponse.json();
        allCities = cities;

        // Group cities by country
        const citiesByCountry = {};
        cities.forEach(city => {
            if (!citiesByCountry[city.country]) {
                citiesByCountry[city.country] = [];
            }
            citiesByCountry[city.country].push(city);
        });

        // Populate city checkboxes (all checked by default), grouped by country
        const checkboxContainer = document.getElementById('cityCheckboxes');
        checkboxContainer.innerHTML = Object.keys(citiesByCountry)
            .sort()
            .map(country => {
                const countryCities = citiesByCountry[country];
                const cityItems = countryCities.map(city => {
                    const status = cityStatus[city.city] || {};
                    const lastIndexed = status.last_indexed ? new Date(status.last_indexed) : null;
                    const hoursSinceIndex = lastIndexed ? (new Date() - lastIndexed) / 1000 / 60 / 60 : null;
                    const canRefresh = !hoursSinceIndex || hoursSinceIndex >= 24;
                    const hasErrors = status.recent_failures > 0;

                    let statusIcon = '';
                    if (hasErrors) {
                        const errorTooltip = `${status.recent_failures} venue(s) failed to index. Click refresh to retry.`;
                        statusIcon = `<span class="city-status-icon error" title="${errorTooltip}">⚠️</span>`;
                    }

                    const refreshDisabled = !canRefresh ? 'disabled' : '';
                    const refreshTitle = canRefresh
                        ? 'Refresh exhibitions'
                        : `Last indexed ${Math.floor(hoursSinceIndex)} hours ago. Wait ${Math.ceil(24 - hoursSinceIndex)} more hours.`;

                    // Check if city should be checked based on saved state
                    const isChecked = selectedCities.length === 0 || selectedCities.includes(city.city);

                    return `
                        <div class="city-item" data-city="${escapeHtml(city.city)}">
                            <div class="city-checkbox-item">
                                <input type="checkbox" value="${escapeHtml(city.city)}" class="city-checkbox" data-count="${city.exhibition_count}" ${isChecked ? 'checked' : ''}>
                                <span class="city-checkbox-label" onclick="toggleCityDetails('${escapeHtml(city.city)}')">${escapeHtml(city.city)}</span>
                                <span class="city-checkbox-count" onclick="toggleCityDetails('${escapeHtml(city.city)}')">(${city.exhibition_count})</span>
                                ${statusIcon}
                                <button class="city-refresh-btn" data-city="${escapeHtml(city.city)}" ${refreshDisabled} title="${refreshTitle}" onclick="event.preventDefault(); event.stopPropagation();">↻</button>
                            </div>
                            <div class="city-exhibitions-mini" id="city-details-${escapeHtml(city.city).replace(/\s+/g, '-')}" style="display: none;"></div>
                        </div>
                    `;
                }).join('');

                const countryId = escapeHtml(country).replace(/\s+/g, '-').toLowerCase();
                const totalCount = countryCities.reduce((sum, city) => sum + parseInt(city.exhibition_count), 0);

                // Check if country should be collapsed
                const isCollapsed = collapsedCountries.has(countryId);
                const collapseIcon = isCollapsed ? '▶' : '▼';
                const citiesDisplay = isCollapsed ? 'none' : 'block';

                // Check if all cities in this country are selected
                const allCitiesChecked = countryCities.every(city =>
                    selectedCities.length === 0 || selectedCities.includes(city.city)
                );

                return `
                    <div class="country-group">
                        <div class="country-header" data-country="${countryId}">
                            <span class="country-collapse" onclick="toggleCountry('${countryId}')">${collapseIcon}</span>
                            <input type="checkbox" class="country-checkbox" data-country="${countryId}" ${allCitiesChecked ? 'checked' : ''} onclick="event.stopPropagation(); toggleCountrySelection('${countryId}')">
                            <span class="country-name">${escapeHtml(country)}</span>
                            <span class="country-count">(${totalCount})</span>
                        </div>
                        <div class="country-cities" id="country-cities-${countryId}" style="display: ${citiesDisplay};">
                            ${cityItems}
                        </div>
                    </div>
                `;
            }).join('');

        // Initialize selectedCities with all cities if no saved state
        if (selectedCities.length === 0) {
            selectedCities = cities.map(c => c.city);
        }
        updateFilterLabel();
        updateToggleButtonText();

        // Add event listeners to checkboxes
        document.querySelectorAll('.city-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', handleCityFilterChange);
        });

        // Add event listeners to refresh buttons
        document.querySelectorAll('.city-refresh-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const city = btn.dataset.city;
                refreshCity(city, btn);
            });
        });
    } catch (error) {
        console.error('Failed to load cities:', error);
    }
}

// Initialize Google Places Autocomplete for city input
function initializeCityAutocomplete() {
    const input = document.getElementById('newCityInput');

    if (!input) return;

    autocomplete = new google.maps.places.Autocomplete(input, {
        types: ['(cities)'],
        fields: ['name', 'address_components'],
        language: 'en'  // Force English names
    });

    autocomplete.addListener('place_changed', () => {
        selectedPlace = autocomplete.getPlace();

        if (selectedPlace && selectedPlace.address_components) {
            // Extract English city name from place
            const cityComponent = selectedPlace.address_components.find(
                component => component.types.includes('locality')
            );

            if (cityComponent) {
                // Use long_name which is the full English name
                input.value = cityComponent.long_name;
                // Store the selected city name for submission
                input.dataset.selectedCity = cityComponent.long_name;
            }
        }
    });

    // Clear stored city name when user types manually
    input.addEventListener('input', () => {
        if (input.dataset.selectedCity && input.value !== input.dataset.selectedCity) {
            delete input.dataset.selectedCity;
        }
    });
}

// Handle city filter changes
function handleCityFilterChange() {
    const checkedBoxes = document.querySelectorAll('.city-checkbox:checked');
    selectedCities = Array.from(checkedBoxes).map(cb => cb.value);

    // Update filter button label
    updateFilterLabel();

    // Update toggle button text
    updateToggleButtonText();

    // Save state to cookies
    saveState();

    // Load exhibitions for selected cities
    loadExhibitions();
}

// Update the filter button label
function updateFilterLabel() {
    const label = document.getElementById('filterLabel');
    const totalCities = allCities.length;

    if (selectedCities.length === 0) {
        label.textContent = 'No Cities Selected';
    } else if (selectedCities.length === totalCities) {
        label.textContent = 'All Cities';
    } else if (selectedCities.length === 1) {
        label.textContent = selectedCities[0];
    } else {
        label.textContent = `${selectedCities.length} Cities Selected`;
    }
}

// Update the toggle button text
function updateToggleButtonText() {
    const toggleBtn = document.getElementById('toggleFilters');
    const checkedBoxes = document.querySelectorAll('.city-checkbox:checked');

    if (checkedBoxes.length > 0) {
        toggleBtn.textContent = 'Clear All';
    } else {
        toggleBtn.textContent = 'Select All';
    }
}

// Load and display exhibitions
async function loadExhibitions() {
    try {
        // Clear any selected venue when loading new exhibitions
        selectedVenue = null;

        // If no cities selected, don't load anything
        if (selectedCities.length === 0) {
            currentExhibitions = [];
            visibleExhibitions = [];
            addMarkersToMap([]);
            displayExhibitions([]);
            document.getElementById('sidebarTitle').textContent = 'No Cities Selected';
            updatePageTitle();
            closeSidebar();
            return;
        }

        let url = '/api/exhibitions';
        url += `?cities=${selectedCities.map(c => encodeURIComponent(c)).join(',')}`;

        const response = await fetch(url);
        const exhibitions = await response.json();

        currentExhibitions = exhibitions;
        addMarkersToMap(exhibitions);

        // Update sidebar title
        let title = 'All Cities';
        if (selectedCities.length === 1) {
            title = selectedCities[0];
        } else if (selectedCities.length > 1) {
            title = `${selectedCities.length} Cities`;
        }
        document.getElementById('sidebarTitle').textContent = title;

        // Adjust map bounds to show all markers
        if (exhibitions.length > 0 && markers.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            exhibitions.forEach(ex => {
                if (ex.latitude && ex.longitude) {
                    bounds.extend({ lat: parseFloat(ex.latitude), lng: parseFloat(ex.longitude) });
                }
            });
            map.fitBounds(bounds);

            // Open sidebar and show visible exhibitions
            openSidebar();
            // Update visible exhibitions after a short delay to ensure bounds are set
            setTimeout(() => updateVisibleExhibitions(), 100);
        } else {
            displayExhibitions([]);
        }
    } catch (error) {
        console.error('Failed to load exhibitions:', error);
    }
}

// Display exhibitions in sidebar
function displayExhibitions(exhibitions) {
    const listContainer = document.getElementById('exhibitionList');

    if (exhibitions.length === 0) {
        listContainer.innerHTML = '<p class="no-results">No exhibitions found</p>';
        return;
    }

    listContainer.innerHTML = exhibitions.map(ex => {
        const imageUrl = ex.image_url || `https://source.unsplash.com/800x450/?art,${encodeURIComponent(ex.title)}`;
        const artist = ex.artist ? `<div class="exhibition-artist">${escapeHtml(ex.artist)}</div>` : '';

        let dates = '';
        if (ex.start_date && ex.end_date) {
            dates = `${formatDate(ex.start_date)} - ${formatDate(ex.end_date)}`;
        } else if (ex.start_date) {
            dates = `From ${formatDate(ex.start_date)}`;
        } else if (ex.end_date) {
            dates = `Until ${formatDate(ex.end_date)}`;
        } else {
            dates = 'Ongoing';
        }

        return `
            <div class="exhibition-card"
                 data-venue-id="${ex.venue_id}"
                 data-lat="${ex.latitude}"
                 data-lng="${ex.longitude}"
                 onmouseenter="highlightMarkerFromCard(${ex.latitude}, ${ex.longitude}, true)"
                 onmouseleave="highlightMarkerFromCard(${ex.latitude}, ${ex.longitude}, false)">
                <img src="${imageUrl}" alt="${escapeHtml(ex.title)}" class="exhibition-image" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22450%22%3E%3Crect fill=%22%23f5f5f5%22 width=%22800%22 height=%22450%22/%3E%3C/svg%3E'">
                <div class="exhibition-info">
                    ${artist}
                    <h3 class="exhibition-title">${escapeHtml(ex.title)}</h3>
                    <div class="exhibition-venue">${escapeHtml(ex.venue_name)}, ${escapeHtml(ex.city)}</div>
                    <div class="exhibition-dates">${dates}</div>
                    ${ex.exhibition_url ? `<a href="${escapeHtml(ex.exhibition_url)}" target="_blank" class="exhibition-link" onclick="event.stopPropagation()">Visit</a>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Add markers to the map using exhibition images
function addMarkersToMap(exhibitions) {
    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    markers = [];

    // Group exhibitions by venue
    const venueMap = new Map();
    exhibitions.forEach(ex => {
        if (ex.latitude && ex.longitude) {
            const key = `${ex.venue_id}`;
            if (!venueMap.has(key)) {
                venueMap.set(key, {
                    lat: parseFloat(ex.latitude),
                    lng: parseFloat(ex.longitude),
                    venue_name: ex.venue_name,
                    city: ex.city,
                    exhibitions: []
                });
            }
            venueMap.get(key).exhibitions.push(ex);
        }
    });

    // Create custom image markers
    venueMap.forEach((venue, key) => {
        // Find first exhibition with an image
        const exhibitionWithImage = venue.exhibitions.find(ex => ex.image_url);
        const imageUrl = exhibitionWithImage?.image_url || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2260%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%2228%22 fill=%22%231a1a1a%22/%3E%3Ctext x=%2230%22 y=%2237%22 font-family=%22Arial%22 font-size=%2224%22 fill=%22white%22 text-anchor=%22middle%22%3E%F0%9F%8E%A8%3C/text%3E%3C/svg%3E';

        // Create overlay for custom image marker
        const overlay = new google.maps.OverlayView();

        overlay.onAdd = function() {
            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.cursor = 'pointer';
            div.dataset.lat = venue.lat;
            div.dataset.lng = venue.lng;
            div.className = 'marker-overlay';

            const img = document.createElement('img');
            img.src = imageUrl;
            img.className = 'custom-marker';
            img.alt = venue.venue_name;

            img.addEventListener('click', () => {
                // Remove selected style from all markers
                document.querySelectorAll('.custom-marker').forEach(m => {
                    m.classList.remove('selected');
                });

                // Remove selected style from all mini-venue-groups
                document.querySelectorAll('.mini-venue-group').forEach(g => {
                    g.classList.remove('selected');
                    g.style.background = '';
                    g.style.borderLeft = '';
                    g.style.paddingLeft = '';
                });

                // Toggle selection
                if (selectedVenue === key) {
                    // Deselect
                    selectedVenue = null;
                    updateVisibleExhibitions();
                } else {
                    // Select
                    selectedVenue = key;
                    img.classList.add('selected');
                    displayExhibitions(venue.exhibitions);
                    document.getElementById('sidebarTitle').textContent = venue.venue_name;
                    openSidebar();
                    map.panTo({ lat: venue.lat, lng: venue.lng });

                    // Highlight the corresponding mini-venue-group
                    highlightSelectedVenueGroup(venue.lat, venue.lng, true);
                }
            });

            // Add hover effect for list items in mini list and main sidebar
            div.addEventListener('mouseenter', () => {
                highlightListItems(venue.lat, venue.lng, true);
                highlightExhibitionCards(venue.lat, venue.lng, true);
            });

            div.addEventListener('mouseleave', () => {
                highlightListItems(venue.lat, venue.lng, false);
                highlightExhibitionCards(venue.lat, venue.lng, false);
            });

            div.appendChild(img);
            this.div = div;

            const panes = this.getPanes();
            panes.overlayMouseTarget.appendChild(div);
        };

        overlay.draw = function() {
            const projection = this.getProjection();
            const position = projection.fromLatLngToDivPixel(
                new google.maps.LatLng(venue.lat, venue.lng)
            );

            if (this.div) {
                this.div.style.left = (position.x - 30) + 'px';
                this.div.style.top = (position.y - 30) + 'px';
            }
        };

        overlay.onRemove = function() {
            if (this.div) {
                this.div.parentNode.removeChild(this.div);
                this.div = null;
            }
        };

        overlay.setMap(map);
        markers.push(overlay);
    });
}

// Setup event listeners
function setupEventListeners() {
    // City filter button
    document.getElementById('cityFilterBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('cityFilterDropdown');
        dropdown.classList.toggle('show');
    });

    // Toggle filters button (Select All / Clear All)
    document.getElementById('toggleFilters').addEventListener('click', (e) => {
        e.stopPropagation();
        const checkedBoxes = document.querySelectorAll('.city-checkbox:checked');
        const allCheckboxes = document.querySelectorAll('.city-checkbox');

        if (checkedBoxes.length > 0) {
            // Clear all
            allCheckboxes.forEach(cb => cb.checked = false);
            selectedCities = [];
        } else {
            // Select all
            allCheckboxes.forEach(cb => cb.checked = true);
            selectedCities = Array.from(allCheckboxes).map(cb => cb.value);
        }

        updateFilterLabel();
        updateToggleButtonText();
        updateCountryCheckboxes();
        saveState();
        loadExhibitions();
    });

    // Close dropdown when clicking outside (but not when clicking inside)
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('cityFilterDropdown');
        const filterBtn = document.getElementById('cityFilterBtn');

        // Only close if clicking outside both the button and dropdown
        if (!dropdown.contains(e.target) && e.target !== filterBtn && !filterBtn.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    // Prevent dropdown from closing when clicking inside it
    document.getElementById('cityFilterDropdown').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Add city toggle button
    document.getElementById('addCityToggleBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const addCityPopover = document.querySelector('.add-city-popover');
        const addCityToggleBtn = document.getElementById('addCityToggleBtn');
        addCityPopover.classList.toggle('show');
        addCityToggleBtn.classList.toggle('active');

        // Focus input when opening
        if (addCityPopover.classList.contains('show')) {
            document.getElementById('newCityInput').focus();
        }
    });

    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
        const addCityContainer = document.querySelector('.add-city-container');
        const addCityPopover = document.querySelector('.add-city-popover');
        const addCityToggleBtn = document.getElementById('addCityToggleBtn');

        if (!addCityContainer.contains(e.target)) {
            addCityPopover.classList.remove('show');
            addCityToggleBtn.classList.remove('active');
        }
    });

    // Prevent popover from closing when clicking inside it
    document.querySelector('.add-city-popover').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Add city submit button
    document.getElementById('addCitySubmitBtn').addEventListener('click', addNewCity);

    // Close sidebar
    document.getElementById('closeSidebar').addEventListener('click', closeSidebar);
}

// Add a new city
async function addNewCity() {
    const input = document.getElementById('newCityInput');
    // Use the stored Google Places name if available, otherwise use the input value
    const city = input.dataset.selectedCity || input.value.trim();

    if (!city) {
        alert('Please select a city from the autocomplete suggestions');
        return;
    }

    // Extract country from selected place
    let country = 'Loading...';
    if (selectedPlace && selectedPlace.address_components) {
        const countryComponent = selectedPlace.address_components.find(
            component => component.types.includes('country')
        );
        if (countryComponent) {
            country = countryComponent.long_name;
        }
    }

    const btn = document.getElementById('addCitySubmitBtn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    const addCityToggleBtn = document.getElementById('addCityToggleBtn');
    const addCityPopover = document.querySelector('.add-city-popover');

    // Add tooltip to loader
    btnLoader.setAttribute('title', `Indexing ${city}... This may take a few minutes.`);

    // Show loader and disable input
    btn.disabled = true;
    input.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'block';

    // Disable the + button and hide the add city popover
    addCityToggleBtn.disabled = true;
    addCityToggleBtn.classList.remove('active');
    addCityPopover.classList.remove('show');

    // Clear input and stored city name immediately
    input.value = '';
    delete input.dataset.selectedCity;

    // Immediately add city to the list with loading indicator
    addCityToListWithLoadingState(city, country);

    try {
        const response = await fetch('/api/cities/index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city })
        });

        const result = await response.json();

        if (response.ok) {
            // Reload cities and exhibitions (state is preserved)
            await loadCities();
            await loadExhibitions();
        } else {
            console.error('Failed to add city:', result.error);
            // Reload to remove the loading state
            await loadCities();
        }
    } catch (error) {
        console.error('Failed to add city:', error.message);
        // Reload to remove the loading state
        await loadCities();
    } finally {
        btnText.style.display = 'block';
        btnLoader.style.display = 'none';
        btn.disabled = false;
        input.disabled = false;
        addCityToggleBtn.disabled = false;
    }
}

// Add a city to the list with a loading indicator
function addCityToListWithLoadingState(cityName, countryName) {
    const checkboxContainer = document.getElementById('cityCheckboxes');
    const countryId = escapeHtml(countryName).replace(/\s+/g, '-').toLowerCase();

    // Try to find existing country group
    let countryGroup = document.getElementById(`country-cities-${countryId}`);

    if (!countryGroup) {
        // Create new country group
        const newCountryHtml = `
            <div class="country-group" id="temp-country-${countryId}">
                <div class="country-header" data-country="${countryId}">
                    <span class="country-collapse" onclick="toggleCountry('${countryId}')">▼</span>
                    <input type="checkbox" class="country-checkbox" data-country="${countryId}" checked onclick="event.stopPropagation(); toggleCountrySelection('${countryId}')">
                    <span class="country-name">${escapeHtml(countryName)}</span>
                    <span class="country-count">(0)</span>
                </div>
                <div class="country-cities" id="country-cities-${countryId}" style="display: block;">
                </div>
            </div>
        `;
        checkboxContainer.insertAdjacentHTML('beforeend', newCountryHtml);
        countryGroup = document.getElementById(`country-cities-${countryId}`);
    }

    // Add loading city item to country group
    const loadingCityHtml = `
        <div class="city-item" id="temp-loading-${escapeHtml(cityName).replace(/\s+/g, '-')}">
            <div class="city-checkbox-item">
                <input type="checkbox" value="${escapeHtml(cityName)}" class="city-checkbox" disabled checked>
                <span class="city-checkbox-label">${escapeHtml(cityName)}</span>
                <span class="city-checkbox-count city-indexing-loader" title="Indexing venues and exhibitions...">⟳</span>
            </div>
        </div>
    `;

    countryGroup.insertAdjacentHTML('beforeend', loadingCityHtml);
}

// Refresh a city's exhibitions
async function refreshCity(city, btnElement) {
    const originalHtml = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = '⟳';
    btnElement.style.animation = 'rotate 1s linear infinite';
    btnElement.title = `Refreshing ${city}... This may take a few minutes.`;

    try {
        const response = await fetch('/api/cities/index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city })
        });

        const result = await response.json();

        if (response.ok) {
            // Log result to console
            console.log(`${city} refreshed: ${result.exhibitions_found} exhibitions`);
            if (result.failed_venues && result.failed_venues.length > 0) {
                console.warn(`${result.failed_venues.length} venue(s) failed to index:`, result.failed_venues);
            }

            // Reload cities and exhibitions (state is preserved)
            await loadCities();
            await loadExhibitions();
        } else {
            console.error('Failed to refresh city:', result.error);
            // Still reload to update the UI
            await loadCities();
        }
    } catch (error) {
        console.error('Failed to refresh:', error.message);
        // Reload to ensure UI is in correct state
        await loadCities();
    } finally {
        btnElement.style.animation = '';
        btnElement.innerHTML = originalHtml;
    }
}

// Toggle country collapse/expand
function toggleCountry(countryId) {
    const citiesContainer = document.getElementById(`country-cities-${countryId}`);
    const collapseIcon = document.querySelector(`[data-country="${countryId}"] .country-collapse`);

    if (citiesContainer.style.display === 'none') {
        citiesContainer.style.display = 'block';
        collapseIcon.textContent = '▼';
        collapsedCountries.delete(countryId);
    } else {
        citiesContainer.style.display = 'none';
        collapseIcon.textContent = '▶';
        collapsedCountries.add(countryId);
    }

    // Save state to cookies
    saveState();
}

// Toggle country selection (check/uncheck all cities in country)
function toggleCountrySelection(countryId) {
    const countryCheckbox = document.querySelector(`.country-checkbox[data-country="${countryId}"]`);
    const citiesContainer = document.getElementById(`country-cities-${countryId}`);
    const cityCheckboxes = citiesContainer.querySelectorAll('.city-checkbox');

    const isChecked = countryCheckbox.checked;

    cityCheckboxes.forEach(cb => {
        cb.checked = isChecked;
    });

    handleCityFilterChange();
}

// Update country checkboxes based on city selections
function updateCountryCheckboxes() {
    const countries = document.querySelectorAll('.country-group');

    countries.forEach(countryGroup => {
        const countryCheckbox = countryGroup.querySelector('.country-checkbox');
        const countryId = countryCheckbox.dataset.country;
        const citiesContainer = document.getElementById(`country-cities-${countryId}`);
        const cityCheckboxes = citiesContainer.querySelectorAll('.city-checkbox');

        // Check if all cities in this country are selected
        const allChecked = Array.from(cityCheckboxes).every(cb => cb.checked);
        countryCheckbox.checked = allChecked;
    });
}

// Toggle city details - show mini exhibition list
async function toggleCityDetails(cityName) {
    const detailsId = `city-details-${cityName.replace(/\s+/g, '-')}`;
    const detailsDiv = document.getElementById(detailsId);

    if (!detailsDiv) return;

    // Toggle visibility
    if (detailsDiv.style.display === 'none' || detailsDiv.style.display === '') {
        // Load and show exhibitions
        detailsDiv.innerHTML = '<div style="padding: 8px; color: #999; font-size: 12px;">Loading...</div>';
        detailsDiv.style.display = 'block';

        try {
            const response = await fetch(`/api/exhibitions?cities=${encodeURIComponent(cityName)}`);
            const exhibitions = await response.json();

            if (exhibitions.length === 0) {
                detailsDiv.innerHTML = '<div style="padding: 8px; color: #999; font-size: 12px;">No exhibitions found</div>';
                return;
            }

            // Group by venue
            const venueMap = new Map();
            exhibitions.forEach(ex => {
                if (!venueMap.has(ex.venue_id)) {
                    venueMap.set(ex.venue_id, {
                        venue_name: ex.venue_name,
                        latitude: ex.latitude,
                        longitude: ex.longitude,
                        exhibitions: []
                    });
                }
                venueMap.get(ex.venue_id).exhibitions.push(ex);
            });

            // Create grouped list - group by venue
            let html = '';
            venueMap.forEach((venue, venueId) => {
                const shortVenue = venue.venue_name.length > 30 ? venue.venue_name.substring(0, 30) + '...' : venue.venue_name;

                html += `<div class="mini-venue-group"
                              data-venue-id="${venueId}"
                              data-lat="${venue.latitude}"
                              data-lng="${venue.longitude}"
                              onmouseenter="highlightMarker(${venue.latitude}, ${venue.longitude}, true)"
                              onmouseleave="highlightMarker(${venue.latitude}, ${venue.longitude}, false)">`;
                html += `<div class="mini-venue-name">${escapeHtml(shortVenue)}</div>`;

                venue.exhibitions.forEach(ex => {
                    const shortTitle = ex.title.length > 35 ? ex.title.substring(0, 35) + '...' : ex.title;
                    html += `<div class="mini-exhibition"
                                  data-venue-id="${venueId}"
                                  data-lat="${ex.latitude}"
                                  data-lng="${ex.longitude}">
                        ${escapeHtml(shortTitle)}
                    </div>`;
                });

                html += `</div>`;
            });

            detailsDiv.innerHTML = html;
        } catch (error) {
            detailsDiv.innerHTML = '<div style="padding: 8px; color: #c62828; font-size: 12px;">Failed to load exhibitions</div>';
        }
    } else {
        // Hide
        detailsDiv.style.display = 'none';
    }
}

// Update visible exhibitions based on map bounds
function updateVisibleExhibitions() {
    if (!map || currentExhibitions.length === 0) return;

    const bounds = map.getBounds();
    if (!bounds) return;

    visibleExhibitions = currentExhibitions.filter(ex => {
        if (!ex.latitude || !ex.longitude) return false;
        const position = new google.maps.LatLng(parseFloat(ex.latitude), parseFloat(ex.longitude));
        return bounds.contains(position);
    });

    // Only update sidebar if no venue is selected
    if (!selectedVenue) {
        displayExhibitions(visibleExhibitions);

        // Update sidebar title based on city selection
        let title = 'All Cities';
        if (selectedCities.length === 1) {
            title = selectedCities[0];
        } else if (selectedCities.length > 1) {
            title = `${selectedCities.length} Cities`;
        }
        document.getElementById('sidebarTitle').textContent = title;
    }

    updatePageTitle();
}

// Update page title with exhibition count
function updatePageTitle() {
    const count = visibleExhibitions.length || currentExhibitions.length || 0;
    document.title = `Art Guide - ${count} exhibition${count !== 1 ? 's' : ''}`;
}

// Highlight marker when hovering exhibition card in main sidebar
function highlightMarkerFromCard(lat, lng, highlight) {
    if (!lat || !lng) return;

    const markers = document.querySelectorAll('.marker-overlay');
    markers.forEach(marker => {
        const markerLat = parseFloat(marker.dataset.lat);
        const markerLng = parseFloat(marker.dataset.lng);

        if (Math.abs(markerLat - lat) < 0.0001 && Math.abs(markerLng - lng) < 0.0001) {
            const img = marker.querySelector('.custom-marker');
            if (img) {
                if (highlight) {
                    img.style.transform = 'scale(1.3)';
                    img.style.zIndex = '1000';
                    img.style.borderColor = '#ff5722';
                    img.style.borderWidth = '4px';
                } else {
                    img.style.transform = '';
                    img.style.zIndex = '';
                    img.style.borderColor = '';
                    img.style.borderWidth = '';
                }
            }
        }
    });
}

// Highlight exhibition cards in main sidebar when hovering marker
function highlightExhibitionCards(lat, lng, highlight) {
    if (!lat || !lng) return;

    const cards = document.querySelectorAll('.exhibition-card');
    cards.forEach(card => {
        const cardLat = parseFloat(card.dataset.lat);
        const cardLng = parseFloat(card.dataset.lng);

        if (Math.abs(cardLat - lat) < 0.0001 && Math.abs(cardLng - lng) < 0.0001) {
            if (highlight) {
                card.classList.add('highlighted');
            } else {
                card.classList.remove('highlighted');
            }
        }
    });
}

// Highlight marker when hovering list item
function highlightMarker(lat, lng, highlight) {
    if (!lat || !lng) return;

    const markers = document.querySelectorAll('.marker-overlay');
    markers.forEach(marker => {
        const markerLat = parseFloat(marker.dataset.lat);
        const markerLng = parseFloat(marker.dataset.lng);

        if (Math.abs(markerLat - lat) < 0.0001 && Math.abs(markerLng - lng) < 0.0001) {
            const img = marker.querySelector('.custom-marker');
            if (img) {
                if (highlight) {
                    img.style.transform = 'scale(1.3)';
                    img.style.zIndex = '1000';
                    img.style.borderColor = '#ff5722';
                    img.style.borderWidth = '4px';
                } else {
                    img.style.transform = '';
                    img.style.zIndex = '';
                    img.style.borderColor = '';
                    img.style.borderWidth = '';
                }
            }
        }
    });
}

// Highlight list items when hovering marker
function highlightListItems(lat, lng, highlight) {
    if (!lat || !lng) return;

    const venueGroups = document.querySelectorAll('.mini-venue-group');
    venueGroups.forEach(group => {
        // Check if any mini-exhibition in this group matches the coordinates
        const exhibitions = group.querySelectorAll('.mini-exhibition');
        const hasMatch = Array.from(exhibitions).some(item => {
            const itemLat = parseFloat(item.dataset.lat);
            const itemLng = parseFloat(item.dataset.lng);
            return Math.abs(itemLat - lat) < 0.0001 && Math.abs(itemLng - lng) < 0.0001;
        });

        if (hasMatch) {
            if (highlight) {
                group.style.background = 'rgba(255, 87, 34, 0.1)';
                group.style.borderLeft = '3px solid #ff5722';
                group.style.paddingLeft = '3px';
            } else {
                // Only remove hover styles if the venue is not selected
                const venueId = exhibitions.length > 0 ? exhibitions[0].dataset.venueId : null;
                if (selectedVenue !== venueId) {
                    group.style.background = '';
                    group.style.borderLeft = '';
                    group.style.paddingLeft = '';
                }
            }
        }
    });
}

// Highlight selected venue group
function highlightSelectedVenueGroup(lat, lng, select) {
    if (!lat || !lng) return;

    const venueGroups = document.querySelectorAll('.mini-venue-group');
    venueGroups.forEach(group => {
        const groupLat = parseFloat(group.dataset.lat);
        const groupLng = parseFloat(group.dataset.lng);

        if (Math.abs(groupLat - lat) < 0.0001 && Math.abs(groupLng - lng) < 0.0001) {
            if (select) {
                group.classList.add('selected');
            } else {
                group.classList.remove('selected');
                group.style.background = '';
                group.style.borderLeft = '';
                group.style.paddingLeft = '';
            }
        }
    });
}

// Open sidebar
function openSidebar() {
    document.getElementById('exhibitionSidebar').classList.add('open');
}

// Close sidebar
function closeSidebar() {
    document.getElementById('exhibitionSidebar').classList.remove('open');
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Make functions globally accessible
window.initMap = initMap;
window.toggleCountry = toggleCountry;
window.toggleCountrySelection = toggleCountrySelection;
window.toggleCityDetails = toggleCityDetails;
window.highlightMarker = highlightMarker;
window.highlightListItems = highlightListItems;
window.highlightMarkerFromCard = highlightMarkerFromCard;
window.highlightExhibitionCards = highlightExhibitionCards;
window.highlightSelectedVenueGroup = highlightSelectedVenueGroup;

// Load Google Maps API with key from backend
async function loadGoogleMaps() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();

        const apiKey = config.googleMapsApiKey;

        if (!apiKey) {
            console.error('Google Maps API key not configured');
            document.getElementById('map').innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999; background: #f5f5f5;">Google Maps API key not configured</div>';
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=en&callback=initMap`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    } catch (error) {
        console.error('Failed to load Google Maps configuration:', error);
    }
}

// Initialize on page load
loadGoogleMaps();
