"""
Main collector logic - orchestrates fetching and storing vehicle data

Run this file to start the 24/7 collector:
    python -m src.main
"""
import time
from datetime import datetime

from .config import load_config, print_config
from .ptv_client import PTVClient
from .db import create_database


class VehicleCollector:
    """Main collector class that orchestrates everything"""
    
    def __init__(self, config):
        """
        Initialize collector with configuration
        
        Args:
            config: Configuration dictionary from load_config()
        """
        self.config = config
        self.poll_interval = config['poll_interval']
        self.enable_db_write = config['enable_db_write']
        
        # Initialize PTV API client
        self.ptv_client = PTVClient(
            config['ptv_user_id'],
            config['ptv_api_key'],
            max_workers=config['parallel_workers']
        )
        
        # Initialize database only if writes are enabled
        if self.enable_db_write:
            self.db = create_database(config)
            print("💾 Database writes ENABLED")
        else:
            self.db = None
            print("🧪 Dry-run mode: Database writes DISABLED")
        
        # Track last positions to avoid storing duplicates
        self.last_positions = {}
        
        print("✅ Vehicle Collector initialized")
    
    def should_store(self, vehicle):
        """
        Determine if we should store this vehicle's position
        
        Only store if:
        - We've never seen this vehicle before, OR
        - Vehicle has moved (position changed), OR
        - More than 5 minutes have passed since last update
        
        Args:
            vehicle: Vehicle dictionary with position data
            
        Returns:
            bool: True if should store, False otherwise
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
        
        # TODO: Add time-based check if needed
        # (requires parsing timestamp strings)
        
        return False
    
    def collect_once(self, route_type=0):
        """
        Run one collection cycle:
        1. Fetch vehicles from PTV API
        2. Filter which ones to store
        3. Store in database (if enabled)
        4. Update last positions cache
        
        Args:
            route_type: 0=train, 1=tram, 2=bus, 3=vline
        """
        route_type_name = {0: "train", 1: "tram", 2: "bus", 3: "vline"}.get(route_type, "unknown")
        
        print(f"\n{'='*60}")
        print(f"🚂 Collection cycle at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"   Route type: {route_type_name}")
        print(f"{'='*60}")
        
        try:
            # Fetch vehicles from PTV API
            vehicles = self.ptv_client.fetch_vehicles(
                route_type=route_type,
                parallel=True,
                use_cache=True
            )
            
            if not vehicles:
                print(f"⚠️  No {route_type_name}s received from API")
                return
            
            # Filter vehicles that should be stored
            vehicles_to_store = []
            for vehicle in vehicles:
                if self.should_store(vehicle):
                    vehicles_to_store.append(vehicle)
                    # Update cache
                    self.last_positions[vehicle.get('vehicle_id')] = vehicle
            
            # Store in database (or just print if dry-run)
            if vehicles_to_store:
                if self.enable_db_write:
                    # Actually write to database
                    self.db.insert_vehicles_bulk(vehicles_to_store)
                    print(f"✅ Stored {len(vehicles_to_store)} new positions in database")
                else:
                    # Dry-run: just print what would be stored
                    print(f"🧪 DRY-RUN: Would store {len(vehicles_to_store)} new positions")
                    print(f"   Sample vehicles: {[v['vehicle_id'] for v in vehicles_to_store[:5]]}")
                
                print(f"   (Filtered {len(vehicles) - len(vehicles_to_store)} unchanged)")
            else:
                print(f"ℹ️  No new positions to store (all {route_type_name}s stationary)")
            
            # Periodic cleanup (only if db writes enabled)
            if self.enable_db_write and len(self.last_positions) % 20 == 0:
                print("\n🧹 Running cleanup...")
                self.db.cleanup_old_data(hours=24)
            
            # Show stats periodically (only if db writes enabled)
            if self.enable_db_write and len(self.last_positions) % 40 == 0:
                print("\n📊 Database stats:")
                stats = self.db.get_stats()
                for key, value in stats.items():
                    print(f"   {key}: {value}")
            
        except KeyboardInterrupt:
            raise  # Let it bubble up to stop the collector
        except Exception as e:
            print(f"❌ Error in collection cycle: {e}")
            import traceback
            traceback.print_exc()
    
    def run_forever(self, route_type=0):
        """
        Run collector continuously (24/7)
        
        This is the main loop that keeps running until:
        - User presses Ctrl+C
        - Fatal error occurs
        
        Args:
            route_type: 0=train, 1=tram, 2=bus, 3=vline
        """
        route_type_name = {0: "train", 1: "tram", 2: "bus", 3: "vline"}.get(route_type, "unknown")
        
        print("\n" + "="*60)
        print("🚂 STARTING VEHICLE COLLECTOR")
        print("="*60)
        print(f"📍 Route type: {route_type_name}")
        print(f"⏱️  Polling every {self.poll_interval} seconds")
        print(f"💾 Database writes: {'ENABLED' if self.enable_db_write else 'DISABLED (dry-run)'}")
        print(f"⌨️  Press Ctrl+C to stop")
        print("="*60 + "\n")
        
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
                    print(f"⏳ Sleeping {sleep_time:.1f}s until next cycle...")
                else:
                    print(f"⚠️  Cycle took {elapsed:.1f}s (longer than {self.poll_interval}s interval)")
                
                time.sleep(sleep_time)
                
        except KeyboardInterrupt:
            print("\n\n" + "="*60)
            print("🛑 STOPPING COLLECTOR")
            print("="*60)
            print(f"Ran {cycle_count} collection cycles")
            if not self.enable_db_write:
                print("Note: Ran in DRY-RUN mode (no data was written to database)")
            print("Goodbye! 👋")
            print("="*60 + "\n")


def run_collector(route_type=0):
    """
    Main entry point for the collector
    
    Loads config, creates collector, and runs it
    
    Args:
        route_type: 0=train, 1=tram, 2=bus, 3=vline (default: 0 for trains)
    """
    try:
        # Load configuration
        config = load_config()
        print_config(config)
        
        # Create and run collector
        collector = VehicleCollector(config)
        collector.run_forever(route_type=route_type)
        
    except ValueError as e:
        print(f"\n❌ Configuration Error: {e}")
        print("\nMake sure you've set these environment variables:")
        print("  - PTV_USER_ID")
        print("  - PTV_API_KEY")
        print("  - DATABASE_URL (only if ENABLE_DB_WRITE=true)")
        print("\nOn Windows:")
        print('  set PTV_USER_ID=your_id')
        print('  set PTV_API_KEY=your_key')
        print('  set DATABASE_URL=your_url')
        print('  set ENABLE_DB_WRITE=true')
        
    except Exception as e:
        print(f"\n❌ Fatal Error: {e}")
        import traceback
        traceback.print_exc()


# ============================================================================
# RUN IT
# ============================================================================

if __name__ == '__main__':
    """
    Run the collector when this file is executed directly
    
    Usage:
        python -m src.main
        
    Or:
        python src/main.py
    """
    run_collector()