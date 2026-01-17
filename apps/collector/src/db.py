"""
Database operations - handles all interactions with Supabase (PostgreSQL)

Two methods available:
1. Direct PostgreSQL connection (requires psycopg2)
2. Supabase REST API (no extra libraries needed)
"""
import json
from urllib.request import Request, urlopen
from psycopg2.extras import execute_values


# ============================================================================
# METHOD 1: Direct PostgreSQL (Requires: pip install psycopg2-binary)
# ============================================================================

class PostgresDatabase:
    """Direct PostgreSQL database connection"""
    
    def __init__(self, database_url):
        """
        Initialize database connection
        
        Args:
            database_url: PostgreSQL connection string
            
        Requires:
            pip install psycopg2-binary
        """
        try:
            import psycopg2
            self.psycopg2 = psycopg2
            self.database_url = database_url
        except ImportError:
            raise ImportError(
                "psycopg2 not installed. Run: pip install psycopg2-binary"
            )
    
    def _get_connection(self):
        """Create a new database connection"""
        return self.psycopg2.connect(self.database_url)
    
    def execute(self, query, params=None):
        """
        Execute a SQL query
        
        Args:
            query: SQL query string
            params: Optional tuple of parameters
            
        Returns:
            list: Query results (if any)
        """
        conn = self._get_connection()
        cur = conn.cursor()
        
        try:
            cur.execute(query, params or ())
            conn.commit()
            
            # Return results if it's a SELECT query
            if cur.description:
                return cur.fetchall()
            return None
        except Exception as e:
            conn.rollback()
            print(f"Database error: {e}")
            raise
        finally:
            cur.close()
            conn.close()
    
    def insert_vehicle(self, vehicle):
        """
        Insert a single vehicle location
        
        Args:
            vehicle: Dictionary with vehicle data
        """
        query = """
            INSERT INTO vehicle_locations 
            (vehicle_id, route_id, run_id, latitude, longitude, 
             timestamp, direction_id, heading, route_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (vehicle_id, timestamp) DO NOTHING
        """
        
        params = (
            vehicle.get('vehicle_id'),
            vehicle.get('route_id'),
            vehicle.get('run_id'),
            vehicle.get('latitude'),
            vehicle.get('longitude'),
            vehicle.get('timestamp'),
            vehicle.get('direction_id'),
            vehicle.get('heading'),
            vehicle.get('route_type', 0)
        )
        
        self.execute(query, params)
    
    # def insert_vehicles_bulk(self, vehicles):
    #     """
    #     Insert multiple vehicles (more efficient than one-by-one)
        
    #     Args:
    #         vehicles: List of vehicle dictionaries
            
    #     Returns:
    #         int: Number of vehicles inserted
    #     """
    #     if not vehicles:
    #         return 0
        
    #     # For simplicity, insert one by one
    #     # For true bulk insert, use execute_values from psycopg2.extras
    #     count = 0
    #     for vehicle in vehicles:
    #         try:
    #             self.insert_vehicle(vehicle)
    #             count += 1
    #         except Exception as e:
    #             print(f"Error inserting vehicle {vehicle.get('vehicle_id')}: {e}")
        
    #     print(f"Inserted {count}/{len(vehicles)} vehicles")
    #     return count
    def insert_vehicles_bulk(self, vehicles):
        if not vehicles:
            return 0
        
        conn = self._get_connection()
        cur = conn.cursor()
        
        # Prepare values as tuples
        values = [
            (
                v.get('vehicle_id'),
                v.get('route_id'),
                v.get('run_id'),
                v.get('latitude'),
                v.get('longitude'),
                v.get('timestamp'),
                v.get('direction_id'),
                v.get('heading'),
                v.get('route_type', 0)
            )
            for v in vehicles
        ]
        
        query = """
            INSERT INTO vehicle_locations
            (vehicle_id, route_id, run_id, latitude, longitude, 
            timestamp, direction_id, heading, route_type)
            VALUES %s
            ON CONFLICT (vehicle_id, timestamp) DO NOTHING
        """
        
        try:
            execute_values(cur, query, values)  # <-- bulk insert
            conn.commit()
            print(f"✅ Bulk inserted {len(values)} vehicles")
            return len(values)
        except Exception as e:
            conn.rollback()
            print(f"❌ Error bulk inserting vehicles: {e}")
            return 0
        finally:
            cur.close()
            conn.close()
    
    def cleanup_old_data(self, hours=24):
        """
        Delete records older than specified hours
        
        Args:
            hours: Number of hours to keep (default 24)
            
        Returns:
            int: Number of records deleted
        """
        query = """
            DELETE FROM vehicle_locations
            WHERE timestamp < NOW() - INTERVAL '%s hours'
        """
        
        result = self.execute(query, (hours,))
        print(f"Cleaned up old data (older than {hours} hours)")
        return 0  # Can't easily get count without RETURNING clause
    
    def get_stats(self):
        """
        Get database statistics
        
        Returns:
            dict: Statistics about stored data
        """
        query = """
            SELECT 
                COUNT(*) as total_records,
                COUNT(DISTINCT vehicle_id) as unique_vehicles,
                MIN(timestamp) as oldest_record,
                MAX(timestamp) as newest_record
            FROM vehicle_locations
        """
        
        result = self.execute(query)
        if result and result[0]:
            row = result[0]
            return {
                'total_records': row[0],
                'unique_vehicles': row[1],
                'oldest_record': row[2],
                'newest_record': row[3]
            }
        return {}


# ============================================================================
# METHOD 2: Supabase REST API (No extra libraries needed!)
# ============================================================================

class SupabaseRestDatabase:
    """Supabase database using REST API (no psycopg2 needed)"""
    
    def __init__(self, supabase_url, supabase_key):
        """
        Initialize Supabase REST client
        
        Args:
            supabase_url: Your Supabase project URL (e.g., https://xxx.supabase.co)
            supabase_key: Your Supabase anon or service key
        """
        self.base_url = f"{supabase_url}/rest/v1"
        self.headers = {
            'apikey': supabase_key,
            'Authorization': f'Bearer {supabase_key}',
            'Content-Type': 'application/json',
            'Prefer': 'resolution=ignore-duplicates'  # Handle conflicts
        }
        
    
    def insert_vehicle(self, vehicle):
        """
        Insert a single vehicle location via REST API
        
        Args:
            vehicle: Dictionary with vehicle data
        """
        url = f"{self.base_url}/vehicle_locations"
        
        # Prepare data
        data = {
            'vehicle_id': vehicle.get('vehicle_id'),
            'route_id': vehicle.get('route_id'),
            'latitude': vehicle.get('latitude'),
            'longitude': vehicle.get('longitude'),
            'timestamp': vehicle.get('timestamp'),
            'direction_id': vehicle.get('direction_id'),
            'heading': vehicle.get('heading')
        }
        
        # Make request
        json_data = json.dumps(data).encode('utf-8')
        request = Request(url, data=json_data, headers=self.headers, method='POST')
        
        try:
            with urlopen(request) as response:
                return response.status == 201
        except Exception as e:
            print(f"Error inserting vehicle: {e}")
            return False
    
    def insert_vehicles_bulk(self, vehicles):
        """
        Insert multiple vehicles via REST API
        
        Args:
            vehicles: List of vehicle dictionaries
            
        Returns:
            int: Number of vehicles inserted
        """
        if not vehicles:
            return 0
        
        count = 0
        for vehicle in vehicles:
            if self.insert_vehicle(vehicle):
                count += 1
        
        print(f"Inserted {count}/{len(vehicles)} vehicles")
        return count
    
    def cleanup_old_data(self, hours=24):
        """
        Note: Cleanup via REST API is more complex
        Better to use PostgreSQL function or do it via SQL
        
        For now, just print a message
        """
        print(f"Note: Cleanup via REST API not implemented")
        print(f"Use PostgreSQL connection or Supabase dashboard to clean old data")
        return 0
    
    def get_stats(self):
        """Get basic stats via REST API"""
        # This would require multiple API calls
        # Simplified for now
        print("Stats via REST API not implemented")
        return {}


# ============================================================================
# FACTORY FUNCTION
# ============================================================================

def create_database(config):
    """
    Create database instance
    
    Args:
        config: Configuration dictionary
        
    Returns:
        PostgresDatabase instance
    """
    if not config.get('database_url'):
        raise ValueError("DATABASE_URL not provided in configuration")
    
    try:
        return PostgresDatabase(config['database_url'])
    except ImportError:
        raise ImportError(
            "psycopg2 not installed. Run: pip install psycopg2-binary"
        )


# ============================================================================
# STANDALONE TESTING
# ============================================================================

if __name__ == '__main__':
    """Test database connections"""
    import os
    
    # Load .env file if it exists
    try:
        from dotenv import load_dotenv
        load_dotenv()
        print("✅ Loaded .env file")
    except ImportError:
        print("⚠️  python-dotenv not installed, trying environment variables...")
    
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("Error: Set DATABASE_URL environment variable")
        exit(1)
    
    print("Testing database connection...")
    
    try:
        db = PostgresDatabase(database_url)
        
        # Test query
        stats = db.get_stats()
        print(f"Success! Database stats: {stats}")
        
    except Exception as e:
        print(f"Error: {e}")