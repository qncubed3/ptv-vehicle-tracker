"""
PTV API Client - handles all interactions with the PTV Timetable API
Supports trains, trams, buses, and V/Line services
Based on your existing PTV implementation
"""
import os
import json
import hmac
import hashlib
import urllib.request
import urllib.parse
from datetime import datetime


class PTVClient:
    """Client for interacting with PTV API"""
    
    BASE_URL = "https://timetableapi.ptv.vic.gov.au"
    ROUTE_TYPE = {"train": 0, "tram": 1, "bus": 2, "vline": 3}
    
    def __init__(self, user_id, api_key, max_workers=10):
        """
        Initialize PTV API client
        
        Args:
            user_id: Your PTV user/developer ID
            api_key: Your PTV API key
            max_workers: Maximum parallel workers for fetching routes (default: 10)
        """
        self.user_id = str(user_id)
        self.api_key = api_key
        self._route_cache = {}  # Cache routes by route_type
        self.max_workers = max_workers
    
    def build_url(self, endpoint, params=None):
        """
        Build complete PTV API URL with signature
        
        Args:
            endpoint: API endpoint (e.g., '/v3/runs/route_type/0')
            params: Optional dictionary of query parameters
            
        Returns:
            str: Complete signed URL
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
        return f"{self.BASE_URL}{uri}&signature={signature}"
    
    def make_request(self, endpoint, params=None, timeout=15):
        """
        Make HTTP request to PTV API
        
        Args:
            endpoint: API endpoint path
            params: Optional query parameters
            timeout: Request timeout in seconds
            
        Returns:
            dict: Parsed JSON response or None if error
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
        Get all routes for a given route type
        
        Args:
            route_type: 0=train, 1=tram, 2=bus, 3=vline
            use_cache: If True, use cached routes (much faster)
            
        Returns:
            list: List of route IDs
        """
        # Check cache first
        if use_cache and route_type in self._route_cache:
            return self._route_cache[route_type]
        
        endpoint = "/v3/routes"
        params = {"route_types": route_type}
        response = self.make_request(endpoint, params)
        
        if not response:
            return []
        
        route_ids = [route.get("route_id") for route in response.get("routes", [])]
        
        # Cache the results
        self._route_cache[route_type] = route_ids
        
        return route_ids
    
    def get_runs_for_route(self, route_id, route_type=0):
        """
        Get all runs (services) for a specific route with vehicle positions
        
        Args:
            route_id: The route ID
            route_type: 0=train, 1=tram, 2=bus, 3=vline
            
        Returns:
            list: List of runs with vehicle positions
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
    
    def fetch_vehicles(self, route_type=0, parallel=True, use_cache=True):
        """
        Fetch all active vehicle positions for a given route type
        
        Args:
            route_type: 0=train, 1=tram, 2=bus, 3=vline
            parallel: If True, fetch routes in parallel (much faster!)
            use_cache: If True, use cached route list (faster on subsequent calls)
        
        Returns:
            list: List of vehicle dictionaries with position data
            
        Format:
        [
            {
                'vehicle_id': 'run_ref_value',
                'route_id': '1',
                'run_id': '12345',
                'latitude': -37.8136,
                'longitude': 144.9631,
                'timestamp': '2025-01-16T10:30:00Z',
                'direction_id': 1,
                'heading': 180.5,
                'route_type': 0
            },
            ...
        ]
        """
        route_type_name = {0: "train", 1: "tram", 2: "bus", 3: "vline"}.get(route_type, "unknown")
        
        print(f"Fetching {route_type_name} routes...")
        route_ids = self.get_routes(route_type=route_type, use_cache=use_cache)
        
        if not route_ids:
            print(f"No {route_type_name} routes found")
            return []
        
        cache_status = "from cache" if use_cache and route_type in self._route_cache else "from API"
        print(f"Found {len(route_ids)} {route_type_name} routes ({cache_status})")
        
        if parallel:
            print(f"Fetching {route_type_name} vehicle positions in parallel...")
            vehicles = self._fetch_vehicles_parallel(route_ids, route_type)
        else:
            print(f"Fetching {route_type_name} vehicle positions sequentially...")
            vehicles = self._fetch_vehicles_sequential(route_ids, route_type)
        
        print(f"✅ Fetched {len(vehicles)} {route_type_name} positions from PTV API")
        return vehicles
    
    def _fetch_vehicles_parallel(self, route_ids, route_type):
        """Fetch vehicles from multiple routes in parallel using threading"""
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        vehicles = []
        
        # Use ThreadPoolExecutor to make parallel requests
        # max_workers from config
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all route fetches at once
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
                    print(f"⚠️  Error fetching route {route_id}: {e}")
        
        return vehicles
    
    def _fetch_vehicles_sequential(self, route_ids, route_type):
        """Fetch vehicles from routes one by one (slower but more reliable)"""
        vehicles = []
        
        for route_id in route_ids:
            runs = self.get_runs_for_route(route_id, route_type=route_type)
            
            for run in runs:
                vehicle = self._extract_vehicle_data(run, route_type)
                if vehicle:
                    vehicles.append(vehicle)
        
        return vehicles
    
    def _extract_vehicle_data(self, run, route_type):
        """
        Extract vehicle data from a run object
        
        Args:
            run: Run object from PTV API
            route_type: Route type (0=train, 1=tram, 2=bus, 3=vline)
            
        Returns:
            dict: Vehicle data or None if invalid
        """
        pos = run.get("vehicle_position", {})
        
        # Skip if no valid coordinates
        if not pos.get("latitude") or not pos.get("longitude"):
            return None
        
        return {
            'vehicle_id': str(run.get('run_ref', run.get('run_id', ''))),
            'route_id': str(run.get('route_id', '')),
            'run_id': str(run.get('run_id', '')),
            'latitude': float(pos.get('latitude')),
            'longitude': float(pos.get('longitude')),
            'timestamp': pos.get('datetime_utc', ''),
            'direction_id': run.get('direction_id'),
            'heading': float(pos.get('bearing', 0)) if pos.get('bearing') else None,
            'route_type': route_type
        }


# ============================================================================
# STANDALONE TESTING
# ============================================================================

if __name__ == '__main__':
    """Test the PTV client independently"""
    import os
    
    # Load .env file if it exists
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("✅ Loaded .env file")
    except ImportError:
        print("⚠️  python-dotenv not installed, trying environment variables...")
    
    # Load credentials from environment
    user_id = os.getenv('PTV_USER_ID')
    api_key = os.getenv('PTV_API_KEY')
    max_workers = int(os.getenv('PARALLEL_WORKERS', '10'))
    
    if not user_id or not api_key:
        print("Error: Set PTV_USER_ID and PTV_API_KEY environment variables")
        print("\nOn Windows:")
        print("  set PTV_USER_ID=your_user_id")
        print("  set PTV_API_KEY=your_api_key")
        exit(1)
    
    # Create client
    print("\nCreating PTV client...")
    print(f"Using {max_workers} parallel workers")
    client = PTVClient(user_id, api_key, max_workers=max_workers)
    
    # Test fetching vehicles
    print("\nTesting PTV API connection...")
    print("This may take a few seconds on first run (fetching route list)...")
    print("Subsequent runs will be faster (using cached routes)\n")
    
    try:
        import time
        
        # First fetch - builds route cache
        print("\n" + "="*60)
        print("FIRST FETCH (building route cache)")
        print("="*60)
        start = time.time()
        vehicles = client.fetch_vehicles(route_type=0, parallel=True, use_cache=True)
        elapsed = time.time() - start
        print(f"Time: {elapsed:.2f} seconds")
        print(f"SUCCESS! Found {len(vehicles)} active vehicles")
        
        # Second fetch - uses route cache
        print("\n" + "="*60)
        print("SECOND FETCH (using cached routes)")
        print("="*60)
        start = time.time()
        vehicles = client.fetch_vehicles(route_type=0, parallel=True, use_cache=True)
        elapsed = time.time() - start
        print(f"Time: {elapsed:.2f} seconds (should be faster!)")
        print(f"SUCCESS! Found {len(vehicles)} active vehicles")
        
        if vehicles:
            print(f"\nFirst 3 vehicles:")
            for vehicle in vehicles[:3]:
                print(f"\nVehicle ID: {vehicle['vehicle_id']}")
                print(f"  Route: {vehicle['route_id']}")
                print(f"  Position: ({vehicle['latitude']}, {vehicle['longitude']})")
                print(f"  Timestamp: {vehicle['timestamp']}")
                print(f"  Direction: {vehicle['direction_id']}")
                print(f"  Heading: {vehicle['heading']}°")
                print(f"  Route Type: {vehicle['route_type']} (0=train, 1=tram, 2=bus, 3=vline)")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()