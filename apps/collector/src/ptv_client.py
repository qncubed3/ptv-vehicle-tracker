import os
import json
import hmac
import hashlib
import urllib.request
import urllib.parse
import time
import traceback

BASE_URL = "https://timetableapi.ptv.vic.gov.au"
ROUTE_TYPE = {"train": 0, "tram": 1, "bus": 2, "vline": 3}

class PTVClient:
    """
    Client for interacting with PTV API
    """

    def __init__(self, user_id, api_key, max_workers=10):
        """
        Initialize PTV API client
        """

        self.user_id = str(user_id)
        self.api_key = api_key
        self._route_cache = {}  # Cache routes by route_type
        self.max_workers = max_workers
    

    def build_url(self, endpoint, params=None):
        """
        Build PTV API URL with signature from endpoint and dictionary of params
        """

        if params is None:
            params = {}
        
        # Add user_id to parameters
        params = params.copy()
        params['devid'] = self.user_id
        
        # Build query string
        query = urllib.parse.urlencode(params)
        uri = f"{endpoint}?{query}"
        
        # Generate HMAC-SHA1 signature
        signature = hmac.new(
            self.api_key.encode('utf-8'),
            uri.encode('utf-8'),
            hashlib.sha1
        ).hexdigest().upper()
        
        # Return complete URL
        return f"{BASE_URL}{uri}&signature={signature}"
    
    
    def make_request(self, endpoint, params=None, timeout=15):
        """
        Make HTTP request to PTV API and returns json response
        """

        url = self.build_url(endpoint, params)
        
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                status = resp.getcode()
                data = resp.read()
                text = data.decode("utf-8")
                body = json.loads(text)
                
                if status == 200:
                    return body
                else:
                    print(f"HTTP Error {status}: {text}")
                    return None
                    
        except urllib.error.HTTPError as e:
            print(f"HTTP Error {e.code}: {e.reason}")
            return None
        except urllib.error.URLError as e:
            print(f"URL Error: {e.reason}")
            return None
        except Exception as e:
            print(f"Unexpected error: {e}")
            return None
        
    
    def get_routes(self, route_type=0, use_cache=True):
        """
        Get list of route ids for a given route type (0=train, 1=tram, 2=bus, 3=vline)
        """
        # Check cache first
        if use_cache and route_type in self._route_cache:
            return self._route_cache[route_type]
        
        endpoint = "/v3/routes"
        params = {"route_types": route_type}
        response = self.make_request(endpoint, params)
        
        if not response:
            return []
        
        route_ids = [
            route.get("route_id")
            for route in response.get("routes", [])
            if route.get("route_id") is not None
        ]
        
        # Cache the results
        self._route_cache[route_type] = route_ids
        
        return route_ids
    
    
    def get_runs_for_route(self, route_id, route_type=0):
        """
        Get list of runs with latest vehicle positions from a route id and route type
        """

        endpoint = f"/v3/runs/route/{route_id}/route_type/{route_type}"
        params = {"expand": "All"}
        response = self.make_request(endpoint, params)
        
        if not response:
            return []
        
        # Filter only runs that have vehicle positions
        runs_with_positions = []
        for run in response.get("runs", []):
            if run.get("vehicle_position"):
                runs_with_positions.append(run)
        
        return runs_with_positions
    

    def fetch_vehicles(self, route_type=0, use_cache=True):
        """
        Fetch all active vehicle data for a given route type
        Option to use cache of route ids
        """
        route_type_name = {0: "train", 1: "tram", 2: "bus", 3: "vline"}.get(route_type, "unknown")
        used_cache = use_cache and route_type in self._route_cache
        
        route_ids = self.get_routes(route_type=route_type, use_cache=use_cache)
        
        if not route_ids:
            print(f"No {route_type_name} routes found")
            return []
        
        cache_status = "from cache" if used_cache else "from API"
        print(f"Found {len(route_ids)} {route_type_name} routes ({cache_status})")
        

        vehicles = self._fetch_vehicles_parallel(route_ids, route_type)
        return self._dedupe_vehicles(vehicles)
    

    def _fetch_vehicles_parallel(self, route_ids, route_type):
        """
        Fetch vehicles from multiple routes in parallel using threading
        """

        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        vehicles = []
        
        # Use ThreadPoolExecutor to make parallel requests
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:

            future_to_route = {
                executor.submit(self.get_runs_for_route, route_id, route_type): route_id
                for route_id in route_ids
            }
            
            # Process results as they complete
            for future in as_completed(future_to_route):
                route_id = future_to_route[future]
                try:
                    runs = future.result()
                    
                    # Extract vehicle data from runs
                    for run in runs:
                        vehicle = self._extract_vehicle_data(run, route_type)
                        if vehicle:
                            vehicles.append(vehicle)
                
                except Exception as e:
                    print(f"Error fetching route {route_id}: {e}")
        
        return vehicles

    def _dedupe_vehicles(self, vehicles):
        """
        Keep one reading per vehicle_id.
        If the same vehicle appears more than once, keep the newest timestamp.
        """
        newest_by_id = {}

        for vehicle in vehicles:
            vehicle_id = vehicle.get('vehicle_id')
            if not vehicle_id:
                continue

            existing = newest_by_id.get(vehicle_id)
            if existing is None or vehicle.get('timestamp', '') >= existing.get('timestamp', ''):
                newest_by_id[vehicle_id] = vehicle

        return list(newest_by_id.values())
    

    def _extract_vehicle_data(self, run, route_type):
        """
        Extract vehicle data from a run object
        """

        pos = run.get("vehicle_position") or {}

        latitude = pos.get("latitude")
        longitude = pos.get("longitude")
        timestamp = pos.get("datetime_utc")
        vehicle_id = run.get('run_ref') or run.get('run_id')

        # Skip incomplete readings before they reach the database.
        if latitude is None or longitude is None:
            return None

        if not timestamp or not vehicle_id:
            return None
        
        bearing = pos.get('bearing')

        return {
            'vehicle_id': str(vehicle_id),
            'route_id': str(run.get('route_id', '')),
            'run_id': str(run.get('run_id', '')),
            'latitude': float(latitude),
            'longitude': float(longitude),
            'timestamp': timestamp,
            'direction_id': run.get('direction_id'),
            'heading': float(bearing) if bearing is not None else None,
            'route_type': route_type
        }


if __name__ == '__main__':
    """
    Test retrieval of data from PTV API
    """
    
    # Load environment variables
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("Loaded .env file")
    except Exception as e:
        print(f"Error: {e}")
        raise
    
    user_id = os.getenv('PTV_USER_ID')
    api_key = os.getenv('PTV_API_KEY')
    max_workers = int(os.getenv('PARALLEL_WORKERS', '10'))
    
    if not user_id or not api_key:
        print("Error: cannot find PTV_USER_ID and PTV_API_KEY")
        exit(1)
    
    # Create client
    print(f"\nCreating PTV client with {max_workers} parallel workers")
    client = PTVClient(user_id, api_key, max_workers=max_workers)

    try:
        print("\nFetching...")
        start = time.time()
        vehicles = client.fetch_vehicles(route_type=0, use_cache=True)
        elapsed = time.time() - start
        print(f"Time: {elapsed:.2f} seconds")
        print(f"Retrieved {len(vehicles)} vehicles")
        

        # Show first n vehicles
        FIRST_N_VEHICLES = 3
        if vehicles:
            print(f"\nFirst {FIRST_N_VEHICLES} vehicles:")
            for vehicle in vehicles[:FIRST_N_VEHICLES]:
                print(f"\nVehicle ID: {vehicle['vehicle_id']}")
                print(f"  Route: {vehicle['route_id']}")
                print(f"  Position: ({vehicle['latitude']}, {vehicle['longitude']})")
                print(f"  Timestamp: {vehicle['timestamp']}")
                print(f"  Direction: {vehicle['direction_id']}")
                print(f"  Heading: {vehicle['heading']}°")
                print(f"  Route Type: {vehicle['route_type']}")

    except Exception as e:
        print(f"Error: {e}")
        traceback.print_exc()
