"""Fetch current conditions and a five-day forecast using OpenWeather (no MCP)."""
import requests
from app.core.config import get_settings


def _candidates(city):
    """OpenWeather q= only accepts 'City' or 'City,CC' — try the likely forms."""
    raw = str(city or "").strip()
    if not raw:
        return []
    out = [raw]
    first = raw.split(",")[0].strip()
    if first and first.lower() != raw.lower():
        out.append(first)
    if first:
        head = first.split()[0].strip(" .'-")
        if len(head) > 2:
            out.append(head)
    seen, unique = set(), []
    for item in out:
        if item.lower() not in seen:
            seen.add(item.lower())
            unique.append(item)
    return unique


def _forecast_payload(forecast_data):
    periods = []
    for item in forecast_data.get("list", [])[:40]:
        periods.append(
            {
                "time": item.get("dt_txt"),
                "temperature_c": item.get("main", {}).get("temp"),
                "condition": item.get("weather", [{}])[0].get("description"),
            }
        )
    return periods


def get_weather(city):
    """Return actual weather observations and short-range forecast for a city."""
    key = get_settings().openweather_api_key

    if not key:
        return "OpenWeather API key missing. Live weather is unavailable."

    if not city:
        return "Destination missing. Ask the traveller which city they will visit."

    last_error = "no matching city"

    # 1) Direct city queries: full string, then the city name before any comma.
    for query in _candidates(city):
        try:
            current = requests.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"q": query, "appid": key, "units": "metric"},
                timeout=15,
            )
            if current.status_code == 404:
                last_error = f"city not found: {query}"
                continue
            current.raise_for_status()

            forecast = requests.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={"q": query, "appid": key, "units": "metric"},
                timeout=15,
            )
            forecast.raise_for_status()

            today = current.json()
            return {
                "city": today.get("name", query),
                "current_temperature_c": today.get("main", {}).get("temp"),
                "current_condition": today.get("weather", [{}])[0].get("description"),
                "forecast_periods": _forecast_payload(forecast.json()),
                "note": "Forecast is for the next few days only, not distant travel dates.",
            }

        except requests.RequestException as error:
            last_error = str(error)

    # 2) Geocoding fallback for "City, Country Name" style destinations.
    for query in _candidates(city):
        try:
            geo = requests.get(
                "https://api.openweathermap.org/geo/1.0/direct",
                params={"q": query, "limit": 1, "appid": key},
                timeout=15,
            )
            geo.raise_for_status()
            rows = geo.json()
            if not rows:
                continue

            lat, lon = rows[0].get("lat"), rows[0].get("lon")
            name = rows[0].get("name", query)

            current = requests.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"lat": lat, "lon": lon, "appid": key, "units": "metric"},
                timeout=15,
            )
            current.raise_for_status()

            forecast = requests.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={"lat": lat, "lon": lon, "appid": key, "units": "metric"},
                timeout=15,
            )
            forecast.raise_for_status()

            today = current.json()
            return {
                "city": today.get("name", name),
                "current_temperature_c": today.get("main", {}).get("temp"),
                "current_condition": today.get("weather", [{}])[0].get("description"),
                "forecast_periods": _forecast_payload(forecast.json()),
                "note": "Forecast is for the next few days only, not distant travel dates.",
            }

        except requests.RequestException as error:
            last_error = str(error)

    return f"OpenWeather unavailable: {last_error}"
