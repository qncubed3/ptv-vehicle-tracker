"""
Route correction based on geographic location.
"""

from .route_zones import ZONES

def correct_route_id(longitude, latitude, route_id, vehicle_id=None):
    """
    Check if vehicle is in a route zone and correct route_id if wrong.
    Returns the corrected route_id.
    """
    
    if not route_id:
        return route_id

    if longitude is None or latitude is None:
        return route_id

    route_id = str(route_id)
    
    for correct_id, bboxes in ZONES.items():
        for bbox in bboxes:
            min_lng, min_lat, max_lng, max_lat = bbox
            if min_lng <= longitude <= max_lng and min_lat <= latitude <= max_lat:
                if route_id != correct_id:
                    print(
                        f"   Overriding route_id for vehicle {vehicle_id}: "
                        f"route {route_id} -> {correct_id}"
                    )
                    return correct_id
                return route_id
    
    return route_id
