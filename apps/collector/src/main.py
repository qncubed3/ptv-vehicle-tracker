import time
from datetime import datetime
from .config import load_config, print_config
from .ptv_client import PTVClient
from .db import create_database
from .route_corrections import correct_route_id


class VehicleCollector:
    """
    Main collector class that orchestrates everything
    """
    
    def __init__(self, config):
        """
        Initialise collector with configuration dict from load_config() 
        """

        self.config = config
        self.poll_interval = config['poll_interval']
        self.enable_db_write = config['enable_db_write']
        
        # Initialise PTV API client
        self.ptv_client = PTVClient(
            config['ptv_user_id'],
            config['ptv_api_key'],
            max_workers=config['parallel_workers']
        )
        
        # Initialise database only if writes are enabled
        if self.enable_db_write:
            self.db = create_database(config)
            print("Database writes ENABLED")
        else:
            self.db = None
            print("Database writes DISABLED")
        
        # Track last positions to avoid storing duplicates
        self.last_positions = {}
        
        print("Vehicle Collector initialised")
    
    def should_store(self, vehicle):
        """
        Determine if we should store this vehicle's position. Only store if vehicle is new or has moved
        """

        vehicle_id = vehicle.get('vehicle_id')
        
        # Always store if we haven't seen this vehicle
        if vehicle_id not in self.last_positions:
            return True
        
        last = self.last_positions[vehicle_id]
        
        # Check if position changed
        lat_diff = abs(vehicle.get('latitude', 0) - last.get('latitude', 0))
        lng_diff = abs(vehicle.get('longitude', 0) - last.get('longitude', 0))
        
        position_changed = lat_diff != 0 or lng_diff != 0
        
        if position_changed:
            return True
        
        return False
    
    def collect_once(self, route_type=0):
        """
        Run one collection cycle:
        1. Fetch vehicles from PTV API
        2. Filter which ones to store
        3. Store in database (if enabled)
        4. Update last positions cache
        """

        route_type_name = {0: "train", 1: "tram", 2: "bus", 3: "vline"}.get(route_type, "unknown")
        
        print(f"Collection cycle at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        try:
            # Fetch vehicles from PTV API
            vehicles = self.ptv_client.fetch_vehicles(
                route_type=route_type,
                use_cache=True
            )
            
            if not vehicles:
                print(f"No {route_type_name}s received from API")
                return
            
            # Filter vehicles that should be stored
            vehicles_to_store = []
            for vehicle in vehicles:

                vehicle['route_id'] = correct_route_id(
                    vehicle.get('longitude'),
                    vehicle.get('latitude'),
                    vehicle.get('route_id'),
                    vehicle.get('vehicle_id')
                )

                if self.should_store(vehicle):
                    vehicles_to_store.append(vehicle)
                    # Update cache
                    self.last_positions[vehicle.get('vehicle_id')] = vehicle
            
            # Store in database
            if vehicles_to_store:
                if self.enable_db_write:
                    self.db.insert_vehicles_bulk(vehicles_to_store)
                    print(f"Stored {len(vehicles_to_store)} new positions in database")
                else:
                    print(f"Found {len(vehicles_to_store)} new positions")
                    print(f"Sample vehicles: {[v['vehicle_id'] for v in vehicles_to_store[:5]]}")
                
                print(f"   (Filtered {len(vehicles) - len(vehicles_to_store)} unchanged)")
            else:
                print("No new positions to store")
            
            # Periodic cleanup (only if db writes enabled)
            if self.enable_db_write and len(self.last_positions) % 20 == 0:
                print("\nRunning cleanup...")
                self.db.cleanup_old_data(hours=24)
            
            # Show stats periodically (only if db writes enabled)
            if self.enable_db_write and len(self.last_positions) % 40 == 0:
                print("\nDatabase stats:")
                stats = self.db.get_stats()
                for key, value in stats.items():
                    print(f"   {key}: {value}")
            
        except KeyboardInterrupt:
            raise 
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
    
    def run_forever(self, route_type=0):
        """
        Run collector continuously until force stop (ctrl c)
        """
        
        print("Starting vehicle collector")
        
        try:
            cycle_count = 0
            
            while True:
                start_time = time.time()
                
                # Run collection
                self.collect_once(route_type=route_type)
                cycle_count += 1
                
                # Calculate sleep time to maintain consistent interval
                elapsed = time.time() - start_time
                sleep_time = max(0, self.poll_interval - elapsed)
                
                if sleep_time > 0:
                    print(f"Sleeping {sleep_time:.1f}s until next cycle")
                else:
                    print(f"Cycle took {elapsed:.1f}s (longer than {self.poll_interval}s interval)")
                
                time.sleep(sleep_time)
                
        except KeyboardInterrupt:
            print("Collector force stop")
            print(f"Ran {cycle_count} collection cycles")


def run_collector(route_type=0):
    """
    Entry point for collector
    """

    try:
        # Load configuration
        config = load_config()
        print_config(config)
        
        # Create and run collector
        collector = VehicleCollector(config)
        collector.run_forever(route_type=route_type)
        
    except ValueError as e:
        print(f"\nConfiguration Error: {e}")
        
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    """
    Run the collector
    """
    run_collector()