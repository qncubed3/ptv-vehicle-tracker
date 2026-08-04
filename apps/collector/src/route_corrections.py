"""
Route correction based on geographic location.
"""

import json
from pathlib import Path
from shapely.geometry import Point, shape


# route_zones.geojson lives in the same directory as this file
GEOJSON_PATH = Path(__file__).with_name("route_zones.geojson")


def _load_route_zones():
    """
    Load route polygons from GeoJSON.

    Returns:
        dict:
            {
                route_id: shapely Polygon
            }
    """

    with open(GEOJSON_PATH, "r") as f:
        geojson = json.load(f)

    zones = {}

    for feature in geojson["features"]:
        route_id = str(feature["properties"]["route_id"])
        zones[route_id] = shape(feature["geometry"])

    return zones


# Loaded once when this module is imported
ROUTE_ZONES = _load_route_zones()


def correct_route_id(longitude, latitude, route_id, vehicle_id=None):
    """
    Check if vehicle is inside a route zone and correct route_id if wrong.

    Args:
        longitude: Vehicle longitude
        latitude: Vehicle latitude
        route_id: Current route ID
        vehicle_id: Optional vehicle identifier for logging

    Returns:
        Corrected route ID
    """

    if not route_id:
        return route_id

    if longitude is None or latitude is None:
        return route_id

    route_id = str(route_id)

    point = Point(longitude, latitude)

    for correct_id, polygon in ROUTE_ZONES.items():

        if polygon.contains(point):

            if route_id != correct_id:
                print(
                    f"   Overriding route_id for vehicle {vehicle_id}: "
                    f"route {route_id} -> {correct_id}"
                )
                return correct_id

            return route_id

    return route_id