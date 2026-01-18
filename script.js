// ==================== Global State ====================
let currentLocation1 = null;
let currentLocation2 = null;
let baseDateTime1 = null;
let baseDateTime2 = null;
let sliderOffsetMinutes = 0;
let updateInterval = null;

// ==================== Initialize App ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    populateLocationDropdowns();
    initializeEventListeners();
});

// ==================== Theme Management ====================
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// ==================== Location Dropdowns ====================
function populateLocationDropdowns() {
    const location1Select = document.getElementById('location1');
    const location2Select = document.getElementById('location2');
    
    timezones.forEach(tz => {
        const option1 = document.createElement('option');
        option1.value = tz.timezone;
        option1.textContent = tz.name;
        location1Select.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = tz.timezone;
        option2.textContent = tz.name;
        location2Select.appendChild(option2);
    });
    
    // Set default values
    location1Select.value = 'Asia/Kolkata';
    location2Select.value = 'America/New_York';
    
    // Trigger initial load with default values
    setTimeout(() => {
        handleLocationChange();
    }, 100);
}

// ==================== Search Functionality ====================
function setupLocationSearch(searchInputId, selectId) {
    const searchInput = document.getElementById(searchInputId);
    const select = document.getElementById(selectId);
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const options = select.options;
        
        for (let i = 1; i < options.length; i++) {
            const option = options[i];
            const text = option.textContent.toLowerCase();
            
            if (text.includes(searchTerm)) {
                option.style.display = '';
            } else {
                option.style.display = 'none';
            }
        }
    });
    
    searchInput.addEventListener('focus', () => {
        select.size = 8; // Show dropdown
    });
    
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            select.size = 1;
        }, 200);
    });
}

// ==================== Event Listeners ====================
function initializeEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Location selection
    document.getElementById('location1').addEventListener('change', handleLocationChange);
    document.getElementById('location2').addEventListener('change', handleLocationChange);
    
    // Search functionality
    setupLocationSearch('location1Search', 'location1');
    setupLocationSearch('location2Search', 'location2');
    
    // Swap button
    document.getElementById('swapButton').addEventListener('click', swapLocations);
    
    // Time slider
    const slider = document.getElementById('timeSlider');
    slider.addEventListener('input', handleSliderChange);
    
    // Reset button
    document.getElementById('resetButton').addEventListener('click', resetToCurrentTime);
}

// ==================== Location Change Handler ====================
async function handleLocationChange() {
    const location1 = document.getElementById('location1').value;
    const location2 = document.getElementById('location2').value;
    
    if (location1 && location2) {
        currentLocation1 = location1;
        currentLocation2 = location2;
        
        // Show time display and slider
        document.getElementById('timeDisplayContainer').style.display = 'grid';
        document.getElementById('sliderContainer').style.display = 'block';
        
        // Update location names
        const loc1Info = timezones.find(tz => tz.timezone === location1);
        const loc2Info = timezones.find(tz => tz.timezone === location2);
        
        document.getElementById('location1Name').textContent = loc1Info.name;
        document.getElementById('location2Name').textContent = loc2Info.name;
        
        // Fetch current times
        await fetchAndUpdateTimes();
        
        // Start live updates
        startLiveUpdates();
    }
}

// ==================== Fetch Times from API ====================
async function fetchAndUpdateTimes() {
    try {
        // Fetch time for both locations
        const [time1, time2] = await Promise.all([
            fetchTimeForZone(currentLocation1),
            fetchTimeForZone(currentLocation2)
        ]);
        
        baseDateTime1 = time1;
        baseDateTime2 = time2;
        
        // Reset slider
        sliderOffsetMinutes = 0;
        const now = new Date(time1.datetime);
        const minutesFromMidnight = now.getHours() * 60 + now.getMinutes();
        document.getElementById('timeSlider').value = minutesFromMidnight;
        
        updateDisplay();
    } catch (error) {
        console.error('Error fetching times:', error);
        // Fallback to browser time if API fails
        useFallbackTime();
    }
}

async function fetchTimeForZone(timezone) {
    try {
        const response = await fetch(`https://worldtimeapi.org/api/timezone/${timezone}`);
        if (!response.ok) throw new Error('API request failed');
        return await response.json();
    } catch (error) {
        // Fallback: use browser's time with timezone calculation
        console.warn('Using fallback time for', timezone);
        return getFallbackTimeForZone(timezone);
    }
}

function getFallbackTimeForZone(timezone) {
    const now = new Date();
    
    // Store the UTC timestamp as the reference point
    return {
        datetime: now.toISOString(),
        timezone: timezone,
        utc_offset: getTimezoneOffset(timezone),
        utc_timestamp: now.getTime()
    };
}

function getTimezoneOffset(timezone) {
    const tzInfo = timezones.find(tz => tz.timezone === timezone);
    return tzInfo ? tzInfo.offset : '+00:00';
}

function useFallbackTime() {
    baseDateTime1 = getFallbackTimeForZone(currentLocation1);
    baseDateTime2 = getFallbackTimeForZone(currentLocation2);
    updateDisplay();
}

// ==================== Update Display ====================
function updateDisplay() {
    if (!baseDateTime1 || !baseDateTime2) return;
    
    // Calculate adjusted times based on slider
    const adjustedTime1 = getAdjustedTime(baseDateTime1, sliderOffsetMinutes);
    const adjustedTime2 = getAdjustedTime(baseDateTime2, sliderOffsetMinutes);
    
    // Update clocks and displays (returns the timezone-specific hour)
    const hour1 = updateTimeDisplay(adjustedTime1, '1');
    const hour2 = updateTimeDisplay(adjustedTime2, '2');
    
    // Update day/night indicators with timezone-specific hours
    updateDayNightIndicatorWithHour(hour1, 'dayNight1');
    updateDayNightIndicatorWithHour(hour2, 'dayNight2');
    
    // Update slider info
    updateSliderInfo(sliderOffsetMinutes);
}

function getAdjustedTime(baseTime, offsetMinutes) {
    const baseDate = new Date(baseTime.datetime);
    const adjustedDate = new Date(baseDate.getTime() + offsetMinutes * 60 * 1000);
    
    return {
        date: adjustedDate,
        timezone: baseTime.timezone,
        utc_offset: baseTime.utc_offset
    };
}

function updateTimeDisplay(timeData, locationNum) {
    const date = timeData.date;
    const timezone = timeData.timezone;
    
    // Convert UTC time to the specific timezone using Intl.DateTimeFormat
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Get time parts for the timezone
    const timeParts = timeFormatter.formatToParts(date);
    const hours = timeParts.find(p => p.type === 'hour').value;
    const minutes = timeParts.find(p => p.type === 'minute').value;
    const seconds = timeParts.find(p => p.type === 'second').value;
    
    // Update digital time
    document.getElementById(`digitalTime${locationNum}`).textContent = `${hours}:${minutes}:${seconds}`;
    
    // Update date display
    const dateString = dateFormatter.format(date);
    document.getElementById(`dateDisplay${locationNum}`).textContent = dateString;
    
    // Update timezone offset
    document.getElementById(`offset${locationNum}`).textContent = `UTC ${timeData.utc_offset}`;
    
    // Update analog clock with timezone-converted time
    const hourNum = parseInt(hours);
    const minuteNum = parseInt(minutes);
    const secondNum = parseInt(seconds);
    updateAnalogClock({ hours: hourNum, minutes: minuteNum, seconds: secondNum }, locationNum);
    
    // Return the hour for day/night indicator
    return hourNum;
}

function updateAnalogClock(timeData, locationNum) {
    const hours = timeData.hours;
    const minutes = timeData.minutes;
    const seconds = timeData.seconds;
    
    // Calculate angles
    const secondAngle = (seconds * 6); // 360 / 60
    const minuteAngle = (minutes * 6) + (seconds * 0.1); // 360 / 60 + smooth transition
    const hourAngle = ((hours % 12) * 30) + (minutes * 0.5); // 360 / 12 + smooth transition
    
    // Apply rotations
    document.getElementById(`hourHand${locationNum}`).style.transform = `rotate(${hourAngle}deg)`;
    document.getElementById(`minuteHand${locationNum}`).style.transform = `rotate(${minuteAngle}deg)`;
    document.getElementById(`secondHand${locationNum}`).style.transform = `rotate(${secondAngle}deg)`;
}

function updateDayNightIndicatorWithHour(hour, elementId) {
    const indicator = document.getElementById(elementId);
    
    // Consider day if hour is between 6 AM and 6 PM
    if (hour >= 6 && hour < 18) {
        indicator.className = 'day-night-indicator day';
    } else {
        indicator.className = 'day-night-indicator night';
    }
}

function updateSliderInfo(offsetMinutes) {
    const offsetElement = document.getElementById('timeOffset');
    
    if (offsetMinutes === 0) {
        offsetElement.textContent = 'Current time';
    } else {
        const hours = Math.floor(Math.abs(offsetMinutes) / 60);
        const mins = Math.abs(offsetMinutes) % 60;
        const sign = offsetMinutes > 0 ? '+' : '-';
        
        let text = sign;
        if (hours > 0) text += `${hours}h `;
        if (mins > 0 || hours === 0) text += `${mins}m`;
        
        offsetElement.textContent = `${text} from now`;
    }
}

// ==================== Slider Handler ====================
function handleSliderChange(e) {
    const sliderValue = parseInt(e.target.value);
    
    // Get current time in minutes from midnight
    const now = new Date(baseDateTime1.datetime);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Calculate offset
    sliderOffsetMinutes = sliderValue - currentMinutes;
    
    // Update display
    updateDisplay();
}

// ==================== Reset to Current Time ====================
function resetToCurrentTime() {
    fetchAndUpdateTimes();
}

// ==================== Swap Locations ====================
function swapLocations() {
    const location1Select = document.getElementById('location1');
    const location2Select = document.getElementById('location2');
    
    const temp = location1Select.value;
    location1Select.value = location2Select.value;
    location2Select.value = temp;
    
    handleLocationChange();
}

// ==================== Live Updates ====================
function startLiveUpdates() {
    // Clear any existing interval
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    // Update every second
    updateInterval = setInterval(() => {
        if (baseDateTime1 && baseDateTime2) {
            // Increment base times by 1 second
            baseDateTime1.datetime = new Date(new Date(baseDateTime1.datetime).getTime() + 1000).toISOString();
            baseDateTime2.datetime = new Date(new Date(baseDateTime2.datetime).getTime() + 1000).toISOString();
            
            // Update slider position if at current time
            if (sliderOffsetMinutes === 0) {
                const now = new Date(baseDateTime1.datetime);
                const minutesFromMidnight = now.getHours() * 60 + now.getMinutes();
                document.getElementById('timeSlider').value = minutesFromMidnight;
            }
            
            updateDisplay();
        }
    }, 1000);
}

// ==================== Cleanup ====================
window.addEventListener('beforeunload', () => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
});
