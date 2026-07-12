import time
from datetime import datetime
from .config import load_config, print_config
from .ptv_client import PTVClient
from .db import create_database
from .route_corrections import correct_route_id


# How often to delete old rows and print database stats.
CLEANUP_EVERY_N_CYCLES = 20
STATS_EVERY_N_CYCLES = 40


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
        self.retention_hours = config['retention_hours']
        self.min_move_degrees = config['min_move_degrees']
        
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
        Determine if we should store this vehicle's position.
        Only store if the vehicle is new or has moved enough to matter.
        """

        vehicle_id = vehicle.get('vehicle_id')

        if not vehicle_id:
            return False
        
        # Always store if we haven't seen this vehicle
        if vehicle_id not in self.last_positions:
            return True
        
        last = self.last_positions[vehicle_id]
        
        lat_diff = abs(vehicle.get('latitude', 0) - last.get('latitude', 0))
        lng_diff = abs(vehicle.get('longitude', 0) - last.get('longitude', 0))

        # Ignore tiny GPS jitter so we do not store near-duplicate rows.
        return lat_diff >= self.min_move_degrees or lng_diff >= self.min_move_degrees
    
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
                if not vehicle.get('vehicle_id') or not vehicle.get('timestamp'):
                    continue

                if vehicle.get('latitude') is None or vehicle.get('longitude') is None:
                    continue

                vehicle['route_id'] = correct_route_id(
                    vehicle.get('longitude'),
                    vehicle.get('latitude'),
                    vehicle.get('route_id'),
                    vehicle.get('vehicle_id')
                )

                if self.should_store(vehicle):
                    vehicles_to_store.append(vehicle)

            # One row per vehicle per cycle. Keep the last reading if duplicates appear.
            vehicles_to_store = self._dedupe_by_vehicle_id(vehicles_to_store)
            
            # Store in database
            if vehicles_to_store:
                if self.enable_db_write:
                    inserted = self.db.insert_vehicles_bulk(vehicles_to_store)

                    # Only update the cache after a successful write so failed
                    # inserts can be retried on the next cycle.
                    if inserted is None:
                        print("Skipping position cache update after failed insert")
                        return

                    self._update_last_positions(vehicles_to_store)
                    print(f"Stored {len(vehicles_to_store)} new positions in database")
                else:
                    self._update_last_positions(vehicles_to_store)
                    print(f"Found {len(vehicles_to_store)} new positions")
                    print(f"Sample vehicles: {[v['vehicle_id'] for v in vehicles_to_store[:5]]}")
                
                print(f"   (Filtered {len(vehicles) - len(vehicles_to_store)} unchanged/invalid)")
            else:
                print("No new positions to store")
            
        except KeyboardInterrupt:
            raise 
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()

    def _dedupe_by_vehicle_id(self, vehicles):
        deduped = {}
        for vehicle in vehicles:
            vehicle_id = vehicle.get('vehicle_id')
            if vehicle_id:
                deduped[vehicle_id] = vehicle
        return list(deduped.values())

    def _update_last_positions(self, vehicles):
        for vehicle in vehicles:
            vehicle_id = vehicle.get('vehicle_id')
            if vehicle_id:
                self.last_positions[vehicle_id] = vehicle

    def run_maintenance(self, cycle_count):
        """
        Periodically delete old rows and print database stats.
        Uses collection cycle count so this keeps running after fleet size stabilises.
        """
        if not self.enable_db_write or not self.db:
            return

        if cycle_count % CLEANUP_EVERY_N_CYCLES == 0:
            print("\nRunning cleanup...")
            deleted = self.db.cleanup_old_data(hours=self.retention_hours)
            print(
                f"Deleted {deleted} vehicle location rows "
                f"older than {self.retention_hours} hours"
            )

        if cycle_count % STATS_EVERY_N_CYCLES == 0:
            print("\nDatabase stats:")
            stats = self.db.get_stats()
            for key, value in stats.items():
                print(f"   {key}: {value}")
    
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

                self.run_maintenance(cycle_count)
                
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
